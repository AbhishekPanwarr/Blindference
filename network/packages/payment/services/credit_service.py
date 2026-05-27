from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

from db.collections import CREDITS
from db.supabase_client import get_supabase_client
from models.db_models import CreditAccountRecord

logger = logging.getLogger("blindference.payment.credits")


class InsufficientCredits(Exception):
    """Raised when a user does not have enough credits for a deduction."""


class CreditService:
    def __init__(self, database, settings):
        self.database = database
        self.settings = settings

    async def get_balance(self, user_address: str) -> dict[str, str]:
        record = await self.database[CREDITS].find_one({"user_address": user_address.lower()})
        if record is None:
            return {
                "balance_cusdc": "0",
                "balance_blind": "0",
                "total_deposited_cusdc": "0",
                "total_deposited_blind": "0",
                "total_spent_cusdc": "0",
                "total_spent_blind": "0",
            }
        return {
            "balance_cusdc": str(record.get("balance_cusdc", 0)),
            "balance_blind": str(record.get("balance_blind", 0)),
            "total_deposited_cusdc": str(record.get("total_deposited_cusdc", 0)),
            "total_deposited_blind": str(record.get("total_deposited_blind", 0)),
            "total_spent_cusdc": str(record.get("total_spent_cusdc", 0)),
            "total_spent_blind": str(record.get("total_spent_blind", 0)),
        }

    async def process_deposit(self, tx_hash: str, chain_service) -> dict[str, Any]:
        """Process a cUSDC or BLIND deposit by tx_hash and credit the user's account."""
        if self.settings.MOCK_CHAIN or not chain_service:
            raise ValueError("Deposit processing requires a live chain connection")

        logger.info("Processing deposit tx=%s", tx_hash)
        receipt = await asyncio.to_thread(
            chain_service.web3_client.w3.eth.get_transaction_receipt,
            tx_hash,
        )
        if receipt is None:
            raise ValueError(f"Transaction {tx_hash} not found")
        if receipt.status != 1:
            raise ValueError(f"Transaction {tx_hash} was reverted")

        icl_wallet = chain_service.web3_client.w3.eth.account.from_key(
            self.settings.ICL_WALLET_PRIVATE_KEY
        ).address

        cusdc_address = self.settings.CUSDC_TOKEN_ADDRESS.lower()
        blind_address = self.settings.BLIND_TOKEN_ADDRESS.lower()
        logger.info(
            "Deposit scan: icl_wallet=%s cusdc=%s blind=%s log_count=%d",
            icl_wallet, cusdc_address, blind_address, len(receipt.logs),
        )

        deposited = {"cusdc": "0", "blind": "0", "from": None}

        for log in receipt.logs:
            log_address = log.address.lower()
            topics_hex = [t.hex() for t in log.topics]
            data_hex = log.data.hex() if isinstance(log.data, bytes) else str(log.data)
            logger.debug("Log: addr=%s topics=%s data=%s", log_address, topics_hex, data_hex)

            if log_address == cusdc_address:
                if len(log.topics) >= 3:
                    from_addr = "0x" + log.topics[1].hex()[-40:]
                    to_addr = "0x" + log.topics[2].hex()[-40:]
                    logger.info("cUSDC Transfer: from=%s to=%s", from_addr, to_addr)
                    if to_addr.lower() == icl_wallet.lower():
                        amount = int(log.data.hex(), 16) if isinstance(log.data, bytes) else int(str(log.data), 16)
                        deposited["cusdc"] = str(amount)
                        deposited["from"] = from_addr
                        logger.info("cUSDC deposit matched: amount=%d", amount)
            elif log_address == blind_address:
                if len(log.topics) >= 3:
                    from_addr = "0x" + log.topics[1].hex()[-40:]
                    to_addr = "0x" + log.topics[2].hex()[-40:]
                    logger.info("BLIND Transfer: from=%s to=%s", from_addr, to_addr)
                    if to_addr.lower() == icl_wallet.lower():
                        amount = int(log.data.hex(), 16) if isinstance(log.data, bytes) else int(str(log.data), 16)
                        deposited["blind"] = str(amount)
                        deposited["from"] = from_addr
                        logger.info("BLIND deposit matched: amount=%d", amount)

        if deposited["from"] is None:
            logger.warning("No deposit to ICL wallet found in tx=%s", tx_hash)
            raise ValueError("No deposit to ICL wallet found in transaction")

        user_address = deposited["from"].lower()
        
        amount_cusdc = int(deposited["cusdc"]) if deposited["cusdc"] != "0" else 0
        amount_blind = int(deposited["blind"]) if deposited["blind"] != "0" else 0
        
        if amount_cusdc == 0 and amount_blind == 0:
            raise ValueError("No cUSDC or BLIND deposit detected")

        logger.info("Crediting %s: cusdc=%s blind=%s", user_address, deposited["cusdc"], deposited["blind"])
        
        # Use atomic RPC for deposit
        client = get_supabase_client()
        result = await client.rpc(
            "atomic_credit_deposit",
            {
                "p_user_address": user_address,
                "p_amount_cusdc": amount_cusdc,
                "p_amount_blind": amount_blind,
            }
        ).execute()
        
        if not result.data:
            raise RuntimeError("atomic_credit_deposit RPC returned no data")

        return await self.get_balance(user_address)

    async def check_balance(self, user_address: str, amount_cusdc: str = "0", amount_blind: str = "0") -> bool:
        """Check if a user has sufficient credits without deducting."""
        user_address = user_address.lower()
        balance = await self.get_balance(user_address)

        amount_cusdc_int = int(amount_cusdc)
        amount_blind_int = int(amount_blind)
        balance_cusdc_int = int(balance["balance_cusdc"])
        balance_blind_int = int(balance["balance_blind"])

        if amount_cusdc_int > 0 and balance_cusdc_int < amount_cusdc_int:
            return False
        if amount_blind_int > 0 and balance_blind_int < amount_blind_int:
            return False
        return True

    async def refund(
        self,
        user_address: str,
        amount_cusdc: str = "0",
        amount_blind: str = "0",
        reason: str = "",
    ) -> dict[str, Any]:
        """Refund credits to a user's account."""
        user_address = user_address.lower()

        amount_cusdc_int = int(amount_cusdc)
        amount_blind_int = int(amount_blind)

        # Use atomic RPC for refund
        client = get_supabase_client()
        result = await client.rpc(
            "atomic_credit_refund",
            {
                "p_user_address": user_address,
                "p_amount_cusdc": amount_cusdc_int,
                "p_amount_blind": amount_blind_int,
            }
        ).execute()
        
        if not result.data:
            raise InsufficientCredits("Credit account not found")

        logger.info(
            "Refunded credits to %s: cUSDC=%s BLIND=%s reason=%s",
            user_address,
            amount_cusdc,
            amount_blind,
            reason,
        )

        return await self.get_balance(user_address)

    async def add_credits(
        self,
        user_address: str,
        amount_cusdc: str = "0",
        amount_blind: str = "0",
        reason: str = "",
    ) -> dict[str, Any]:
        """Add credits to a user's account (e.g. package purchase or refund).

        Uses atomic_credit_deposit RPC so total_deposited counters are incremented.
        """
        user_address = user_address.lower()

        amount_cusdc_int = int(amount_cusdc)
        amount_blind_int = int(amount_blind)

        # Use atomic RPC for deposit
        client = get_supabase_client()
        result = await client.rpc(
            "atomic_credit_deposit",
            {
                "p_user_address": user_address,
                "p_amount_cusdc": amount_cusdc_int,
                "p_amount_blind": amount_blind_int,
            }
        ).execute()
        
        if not result.data:
            raise RuntimeError("atomic_credit_deposit RPC returned no data")

        logger.info(
            "Added credits to %s: cUSDC=%s BLIND=%s reason=%s",
            user_address,
            amount_cusdc,
            amount_blind,
            reason,
        )

        return await self.get_balance(user_address)

    async def deduct(
        self,
        user_address: str,
        amount_cusdc: str = "0",
        amount_blind: str = "0",
        reason: str = "",
    ) -> dict[str, Any]:
        """Atomically deduct credits from a user's account."""
        user_address = user_address.lower()
        balance = await self.get_balance(user_address)

        amount_cusdc_int = int(amount_cusdc)
        amount_blind_int = int(amount_blind)
        balance_cusdc_int = int(balance["balance_cusdc"])
        balance_blind_int = int(balance["balance_blind"])

        if amount_cusdc_int > 0 and balance_cusdc_int < amount_cusdc_int:
            raise InsufficientCredits(
                f"Insufficient cUSDC credits: have {balance['balance_cusdc']}, need {amount_cusdc}"
            )
        if amount_blind_int > 0 and balance_blind_int < amount_blind_int:
            raise InsufficientCredits(
                f"Insufficient BLIND credits: have {balance['balance_blind']}, need {amount_blind}"
            )

        # Use atomic RPC for deduction
        client = get_supabase_client()
        result = await client.rpc(
            "atomic_credit_deduct",
            {
                "p_user_address": user_address,
                "p_amount_cusdc": amount_cusdc_int,
                "p_amount_blind": amount_blind_int,
            }
        ).execute()
        
        if not result.data:
            raise InsufficientCredits("Credit account not found")

        logger.info(
            "Deducted credits from %s: cUSDC=%s BLIND=%s reason=%s",
            user_address,
            amount_cusdc,
            amount_blind,
            reason,
        )

        return await self.get_balance(user_address)
