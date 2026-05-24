from __future__ import annotations

import logging
from typing import Any

from chain.web3_client import Web3Client
from config import Settings


class BlindferenceStakingClient:
    def __init__(self, web3_client: Web3Client, settings: Settings):
        self.web3_client = web3_client
        self.settings = settings
        if settings.BLINDFERENCE_STAKING_ADDRESS and settings.BLINDFERENCE_STAKING_ADDRESS != "0x" + "0" * 40:
            self.contract = web3_client.get_contract(
                "BlindferenceStaking",
                settings.BLINDFERENCE_STAKING_ADDRESS,
            )
        else:
            self.contract = None

    def is_deployed(self) -> bool:
        return self.contract is not None

    def get_stake_info(self, node_address: str) -> dict[str, Any] | None:
        if self.contract is None:
            return None
        try:
            info = self.contract.functions.getStakeInfo(
                self.web3_client.checksum_address(node_address)
            ).call()
            return {
                "staked": int(info[0]),
                "unbonding": int(info[1]),
                "unbondingAvailableAt": int(info[2]),
                "consecutiveFailures": int(info[3]),
                "active": bool(info[4]),
            }
        except Exception:
            return None

    def record_failure(self, node_address: str) -> dict[str, Any] | None:
        if self.contract is None:
            return None
        try:
            result = self.web3_client.send_transaction(
                self.contract.functions.recordFailure(
                    self.web3_client.checksum_address(node_address)
                )
            )
            return {"tx_hash": result["tx_hash"]}
        except Exception as exc:
            logger = logging.getLogger("blindference.icl.chain")
            logger.warning("recordFailure failed for %s: %s", node_address, exc)
            return None

    def reset_failures(self, node_address: str) -> dict[str, Any] | None:
        if self.contract is None:
            return None
        try:
            result = self.web3_client.send_transaction(
                self.contract.functions.resetFailures(
                    self.web3_client.checksum_address(node_address)
                )
            )
            return {"tx_hash": result["tx_hash"]}
        except Exception as exc:
            logger = logging.getLogger("blindference.icl.chain")
            logger.warning("resetFailures failed for %s: %s", node_address, exc)
            return None

    def slash(self, node_address: str, amount: int, reason: str) -> dict[str, Any] | None:
        if self.contract is None:
            return None
        try:
            result = self.web3_client.send_transaction(
                self.contract.functions.slash(
                    self.web3_client.checksum_address(node_address),
                    amount,
                    reason,
                )
            )
            return {"tx_hash": result["tx_hash"]}
        except Exception as exc:
            logger = logging.getLogger("blindference.icl.chain")
            logger.warning("slash failed for %s: %s", node_address, exc)
            return None
