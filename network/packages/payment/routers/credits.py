from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from bson.decimal128 import Decimal128
from fastapi import APIRouter, Depends, HTTPException
from web3 import Web3

from db.collections import CREDITS
from services import ServiceContainer, get_service_container


def _to_decimal128(value: int | str) -> Decimal128:
    """Convert a Python int or string to MongoDB Decimal128."""
    return Decimal128(Decimal(str(value)))

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

    # Credit the user's account
    credits_dec = _to_decimal128(credits_cusdc)
    await services.database[CREDITS].update_one(
        {"user_address": user_address},
        {
            "$inc": {
                "balance_cusdc": credits_dec,
                "total_deposited_cusdc": credits_dec,
            },
            "$set": {
                "user_address": user_address,
                "last_updated": datetime.now(timezone.utc),
            },
            "$setOnInsert": {"created_at": datetime.now(timezone.utc)},
        },
        upsert=True,
    )

    balance = await services.credit_service.get_balance(user_address)

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
        # Credit the user's account
        amount_dec = _to_decimal128(amount_cusdc_int)
        await services.database[CREDITS].update_one(
            {"user_address": user_address.lower()},
            {
                "$inc": {
                    "balance_cusdc": amount_dec,
                    "total_deposited_cusdc": amount_dec,
                },
                "$set": {
                    "user_address": user_address.lower(),
                    "last_updated": datetime.now(timezone.utc),
                },
                "$setOnInsert": {"created_at": datetime.now(timezone.utc)},
            },
            upsert=True,
        )

        balance = await services.credit_service.get_balance(user_address)

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
    record.pop("_id", None)
    return {"found": True, "address": address.lower(), "record": record}
