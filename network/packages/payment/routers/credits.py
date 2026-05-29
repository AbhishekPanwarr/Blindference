from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from web3 import Web3

from services import ServiceContainer, get_service_container


router = APIRouter(prefix="/v1", tags=["credits"])
logger = logging.getLogger("blindference.payment.router")


@router.get("/balance/{address}")
async def get_balance(
    address: str,
    services: ServiceContainer = Depends(get_service_container),
) -> dict[str, Any]:
    """Return credit balance for a user address."""
    balance = await services.credit_service.get_balance(address)
    return {"user_address": address.lower(), **balance}


@router.get("/balance/stream/{address}")
async def balance_stream(
    address: str,
    request: Request,
    services: ServiceContainer = Depends(get_service_container),
):
    """Server-Sent Events (SSE) stream of balance updates for *address*.

    The backend polls the database every 10 seconds and only pushes an
    event when the balance actually changes. This eliminates frontend
    polling and scales to many concurrent clients per address.
    """
    user_address = address.lower()
    last_balance: dict[str, Any] | None = None

    async def event_generator():
        nonlocal last_balance
        while True:
            if await request.is_disconnected():
                break
            try:
                balance = await services.credit_service.get_balance(user_address)
                payload = {"user_address": user_address, **balance}
                if payload != last_balance:
                    last_balance = payload
                    yield f"data: {json.dumps(payload)}\n\n"
            except Exception as exc:
                logger.warning("Balance stream error for %s: %s", user_address, exc)
            await asyncio.sleep(10)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # Disable nginx buffering for SSE
        },
    )


@router.post("/deposit")
async def notify_deposit(
    payload: dict[str, Any],
    services: ServiceContainer = Depends(get_service_container),
) -> dict[str, Any]:
    """Notify the Payment Service of a cUSDC or BLIND deposit tx so it can credit the user."""
    tx_hash = payload.get("tx_hash")
    if not tx_hash:
        raise HTTPException(status_code=400, detail="tx_hash is required")
    try:
        balance = await services.credit_service.process_deposit(
            tx_hash, services.chain_service
        )
        return {"status": "credited", "tx_hash": tx_hash, **balance}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Deposit processing failed: {exc}") from exc


@router.get("/credits/packages")
async def get_credit_packages(
    services: ServiceContainer = Depends(get_service_container),
) -> dict[str, Any]:
    """Return available credit packages (sanitized — no internal keys)."""
    packages = []
    for pkg in services.settings.CREDIT_PACKAGES:
        base_calls = pkg["base_calls"]
        bonus = pkg["bonus_percent"]
        total_calls = int(base_calls * (1 + bonus / 100))
        price_eth = pkg["price_blind_wei"] / 1e18
        packages.append(
            {
                "id": pkg["id"],
                "name": pkg["name"],
                "base_calls": base_calls,
                "bonus_percent": bonus,
                "total_calls": total_calls,
                "price_blind": price_eth,
                "price_blind_wei": pkg["price_blind_wei"],
            }
        )
    return {"packages": packages}


@router.post("/credits/purchase-package")
async def purchase_credit_package(
    payload: dict[str, Any],
    services: ServiceContainer = Depends(get_service_container),
) -> dict[str, Any]:
    """Purchase a credit package by sending BLIND to the Payment Service wallet.

    Body: { "package_id": str, "tx_hash": str }
    """
    package_id = payload.get("package_id", "")
    tx_hash = payload.get("tx_hash", "")

    if not package_id or not tx_hash:
        raise HTTPException(status_code=400, detail="package_id and tx_hash are required")

    # Look up package
    package = None
    for pkg in services.settings.CREDIT_PACKAGES:
        if pkg["id"] == package_id:
            package = pkg
            break
    if package is None:
        raise HTTPException(status_code=404, detail=f"Package '{package_id}' not found")

    # Verify transaction on-chain
    try:
        receipt = await asyncio.to_thread(
            services.chain_service.web3_client.w3.eth.get_transaction_receipt,
            tx_hash,
        )
    except Exception as exc:
        logger.error("Failed to fetch receipt for tx=%s: %s", tx_hash, exc)
        raise HTTPException(status_code=400, detail=f"Transaction not found: {exc}") from exc

    if receipt is None:
        raise HTTPException(status_code=400, detail="Transaction not found on-chain")
    if receipt.status != 1:
        raise HTTPException(status_code=400, detail="Transaction was reverted")

    payment_wallet = services.settings.PAYMENT_WALLET_ADDRESS.lower()
    blind_address = services.settings.BLIND_TOKEN_ADDRESS.lower()
    expected_amount = package["price_blind_wei"]

    deposited = {"amount": 0, "from": None}

    for log in receipt.logs:
        log_address = log.address.lower()
        if log_address == blind_address and len(log.topics) >= 3:
            from_addr = "0x" + log.topics[1].hex()[-40:]
            to_addr = "0x" + log.topics[2].hex()[-40:]
            if to_addr.lower() == payment_wallet:
                amount = int(log.data.hex(), 16) if isinstance(log.data, bytes) else int(str(log.data), 16)
                deposited["amount"] = amount
                deposited["from"] = from_addr
                logger.info(
                    "Package purchase BLIND transfer: from=%s to=%s amount=%d expected=%d",
                    from_addr,
                    to_addr,
                    amount,
                    expected_amount,
                )

    if deposited["from"] is None:
        raise HTTPException(
            status_code=400,
            detail=f"No BLIND transfer to Payment Service wallet ({payment_wallet}) found in transaction",
        )

    if deposited["amount"] != expected_amount:
        raise HTTPException(
            status_code=400,
            detail=f"BLIND amount mismatch: expected {expected_amount}, got {deposited['amount']}",
        )

    # Calculate cUSDC-equivalent credits
    base_cusdc_per_call = services.settings.JOB_PRICE_CUSDC.get("qwen2.5-7b", 1_000)
    bonus = package["bonus_percent"]
    credits_cusdc = int(package["base_calls"] * base_cusdc_per_call * (1 + bonus / 100))

    user_address = deposited["from"].lower()

    # Credit the user's account via atomic deposit RPC
    balance = await services.credit_service.add_credits(
        user_address=user_address,
        amount_cusdc=str(credits_cusdc),
        amount_blind="0",
        reason=f"package_purchase:{package_id}",
    )

    logger.info(
        "Package purchased: user=%s package=%s credits_cusdc=%d tx=%s",
        user_address,
        package_id,
        credits_cusdc,
        tx_hash,
    )

    return {
        "status": "success",
        "package_id": package_id,
        "credits_awarded_cusdc": credits_cusdc,
        "tx_hash": tx_hash,
        **balance,
    }


@router.post("/escrow/{escrow_id}/release")
async def release_escrow(
    escrow_id: int,
    payload: dict[str, Any],
    services: ServiceContainer = Depends(get_service_container),
) -> dict[str, Any]:
    """Release or refund an escrow based on inference result."""
    # TODO: Implement actual escrow release via Reineira SDK
    # For now, return success (escrow redemption is handled on-chain by the inference gate resolver)
    return {
        "status": "released",
        "escrow_id": escrow_id,
        "message": "Escrow release is handled on-chain by the inference gate resolver",
    }


@router.post("/credits/refund")
async def refund_credits(
    payload: dict[str, Any],
    services: ServiceContainer = Depends(get_service_container),
) -> dict[str, Any]:
    """Refund credits to a user after successful dispute resolution.

    Body: {
        "user_address": str,
        "amount_cusdc": int,
        "reason": str,
    }
    """
    user_address = payload.get("user_address", "")
    amount_cusdc = str(payload.get("amount_cusdc", 0))
    reason = payload.get("reason", "dispute_refund")

    amount_cusdc_int = int(amount_cusdc)
    if not user_address or amount_cusdc_int <= 0:
        raise HTTPException(
            status_code=400,
            detail="user_address and positive amount_cusdc are required"
        )

    try:
        # Credit the user's account via atomic deposit RPC
        balance = await services.credit_service.add_credits(
            user_address=user_address,
            amount_cusdc=str(amount_cusdc_int),
            amount_blind="0",
            reason=reason,
        )

        logger.info(
            "Credits refunded: user=%s amount_cusdc=%s reason=%s",
            user_address,
            amount_cusdc,
            reason,
        )

        return {
            "status": "refunded",
            "user_address": user_address.lower(),
            "amount_cusdc": amount_cusdc,
            "reason": reason,
            **balance,
        }
    except Exception as exc:
        logger.error("Credit refund failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Credit refund failed: {exc}") from exc


@router.get("/debug/{address}")
async def debug_credits(
    address: str,
    services: ServiceContainer = Depends(get_service_container),
) -> dict[str, Any]:
    """Debug endpoint: dump raw credits record."""
    record = await services.database[CREDITS].find_one({"user_address": address.lower()})
    if record is None:
        return {"found": False, "address": address.lower()}
    record.pop("id", None)
    return {"found": True, "address": address.lower(), "record": record}
