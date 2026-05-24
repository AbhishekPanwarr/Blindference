from __future__ import annotations

import asyncio
import logging
import os
import subprocess
from pathlib import Path
from typing import Any

from eth_account import Account
from eth_account.signers.local import LocalAccount
from web3 import HTTPProvider, Web3

logger = logging.getLogger("blindference.payment.chain")


class Web3Client:
    def __init__(self, settings):
        self.settings = settings
        self.w3 = Web3(HTTPProvider(settings.ARBITRUM_SEPOLIA_RPC, request_kwargs={"timeout": 30}))
        self.account: LocalAccount = Account.from_key(settings.ICL_WALLET_PRIVATE_KEY)

    def is_connected(self) -> bool:
        try:
            return self.w3.is_connected()
        except Exception:
            return False

    def keccak_text(self, value: str) -> str:
        return Web3.keccak(text=value).hex()

    def ensure_hex_prefix(self, value: str) -> str:
        return value if value.startswith("0x") else f"0x{value}"


class ChainService:
    def __init__(self, settings):
        self.settings = settings
        self.web3_client = Web3Client(settings)

    async def create_and_fund_escrow(
        self,
        *,
        amount_cusdc: int,
        job_id: str,
        owner_address: str,
        resolver_address: str,
    ) -> dict[str, Any]:
        """Create and fund a Reineira escrow for a credit-paid inference job.

        Uses the Reineira SDK via a TypeScript subprocess (create_escrow.ts).
        Falls back to a deterministic mock ID if the script fails or MOCK_CHAIN is True.
        """
        if self.settings.MOCK_CHAIN:
            escrow_id = int(
                self.web3_client.keccak_text(f"mock-escrow:{job_id}"),
                16,
            ) % (2 ** 64)
            return {
                "escrow_id": escrow_id,
                "tx_hash": self.web3_client.ensure_hex_prefix(
                    self.web3_client.keccak_text(f"mock-escrow-create:{job_id}")
                ),
                "status": "mock",
            }

        script_path = Path(__file__).resolve().parents[1] / "scripts" / "create_escrow.ts"

        if not script_path.exists():
            logger.warning(
                "Reineira escrow script not found at %s — using placeholder", script_path
            )
            escrow_id = int(
                self.web3_client.keccak_text(f"placeholder-escrow:{job_id}"),
                16,
            ) % (2 ** 64)
            return {
                "escrow_id": escrow_id,
                "tx_hash": None,
                "status": "placeholder",
            }

        env = {
            **os.environ,
            "ICL_WALLET_PRIVATE_KEY": self.settings.ICL_WALLET_PRIVATE_KEY,
            "ARBITRUM_SEPOLIA_RPC_URL": self.settings.ARBITRUM_SEPOLIA_RPC,
            "ARBITRUM_SEPOLIA_RPC": self.settings.ARBITRUM_SEPOLIA_RPC,
        }

        cmd = [
            "npx",
            "ts-node",
            str(script_path),
            "--amount",
            str(amount_cusdc),
            "--job-id",
            job_id,
            "--owner",
            owner_address,
            "--resolver",
            resolver_address,
        ]

        try:
            result = await asyncio.to_thread(
                subprocess.run,
                cmd,
                capture_output=True,
                text=True,
                timeout=120,
                cwd=str(script_path.parents[1]),
                env=env,
            )
        except subprocess.TimeoutExpired:
            logger.error("Reineira escrow creation timed out for job=%s", job_id)
            raise RuntimeError("Escrow creation timed out")
        except Exception as exc:
            logger.error("Reineira escrow creation failed for job=%s: %s", job_id, exc)
            raise RuntimeError(f"Escrow creation failed: {exc}") from exc

        if result.returncode != 0:
            stderr = result.stderr.strip() if result.stderr else "<no stderr>"
            logger.error(
                "Reineira escrow creation failed for job=%s (exit %d): %s",
                job_id,
                result.returncode,
                stderr,
            )
            raise RuntimeError(
                f"Escrow creation failed (exit {result.returncode}): {stderr}"
            )

        stdout = result.stdout.strip()
        if not stdout.isdigit():
            logger.error(
                "Reineira escrow creation returned non-numeric escrow ID: %s", stdout
            )
            raise RuntimeError(f"Invalid escrow ID returned: {stdout}")

        escrow_id = int(stdout)
        logger.info(
            "Reineira escrow created and funded: escrow_id=%d job=%s", escrow_id, job_id
        )
        return {
            "escrow_id": escrow_id,
            "tx_hash": None,
            "status": "live",
        }

    async def purchase_insurance(
        self,
        *,
        escrow_id: int,
        job_price: int,
        job_id: str,
        user_address: str,
    ) -> dict[str, Any]:
        """Purchase Reineira insurance coverage for an inference job.

        Uses the Reineira SDK via a TypeScript subprocess (purchase_insurance.ts).
        Falls back to a deterministic mock coverage ID if the script fails.
        """
        if self.settings.MOCK_CHAIN:
            coverage_id = int(
                self.web3_client.keccak_text(f"mock-coverage:{escrow_id}:{job_id}"),
                16,
            ) % (2 ** 64)
            return {
                "coverage_id": coverage_id,
                "status": "mock",
            }

        script_path = Path(__file__).resolve().parents[1] / "scripts" / "purchase_insurance.ts"

        if not script_path.exists():
            logger.warning(
                "Insurance purchase script not found at %s — using mock", script_path
            )
            coverage_id = int(
                self.web3_client.keccak_text(f"mock-coverage:{escrow_id}:{job_id}"),
                16,
            ) % (2 ** 64)
            return {
                "coverage_id": coverage_id,
                "status": "mock",
            }

        env = {
            **os.environ,
            "ICL_WALLET_PRIVATE_KEY": self.settings.ICL_WALLET_PRIVATE_KEY,
            "ARBITRUM_SEPOLIA_RPC": self.settings.ARBITRUM_SEPOLIA_RPC,
            "ARBITRUM_SEPOLIA_RPC_URL": self.settings.ARBITRUM_SEPOLIA_RPC,
            "POLICY_ADAPTER_ADDRESS": getattr(self.settings, "POLICY_ADAPTER_ADDRESS", ""),
            "POOL_ADDRESS": getattr(self.settings, "POOL_ADDRESS", ""),
            "INFERENCE_GATE_ADDRESS": getattr(self.settings, "INFERENCE_GATE_ADDRESS", ""),
        }

        cmd = [
            "npx",
            "ts-node",
            str(script_path),
            "--escrow-id",
            str(escrow_id),
            "--amount",
            str(job_price),
            "--job-id",
            job_id,
            "--policy-addr",
            getattr(self.settings, "POLICY_ADAPTER_ADDRESS", ""),
            "--pool-addr",
            getattr(self.settings, "POOL_ADDRESS", ""),
        ]

        try:
            result = await asyncio.to_thread(
                subprocess.run,
                cmd,
                capture_output=True,
                text=True,
                timeout=120,
                cwd=str(script_path.parents[1]),
                env=env,
            )
        except subprocess.TimeoutExpired:
            logger.error("Insurance purchase timed out for job=%s", job_id)
            raise RuntimeError("Insurance purchase timed out")
        except Exception as exc:
            logger.error("Insurance purchase failed for job=%s: %s", job_id, exc)
            raise RuntimeError(f"Insurance purchase failed: {exc}") from exc

        if result.returncode != 0:
            stderr = result.stderr.strip() if result.stderr else "<no stderr>"
            logger.error(
                "Insurance purchase failed for job=%s (exit %d): %s",
                job_id,
                result.returncode,
                stderr,
            )
            # For testnet, return mock coverage ID instead of failing
            coverage_id = int(
                self.web3_client.keccak_text(f"mock-coverage-fallback:{escrow_id}:{job_id}"),
                16,
            ) % (2 ** 64)
            logger.warning("Returning mock coverage_id=%d for job=%s", coverage_id, job_id)
            return {
                "coverage_id": coverage_id,
                "status": "mock_fallback",
            }

        stdout = result.stdout.strip()
        if not stdout.isdigit():
            logger.error(
                "Insurance purchase returned non-numeric coverage ID: %s", stdout
            )
            raise RuntimeError(f"Invalid coverage ID returned: {stdout}")

        coverage_id = int(stdout)
        logger.info(
            "Insurance purchased: coverage_id=%d escrow=%d job=%s", coverage_id, escrow_id, job_id
        )
        return {
            "coverage_id": coverage_id,
            "status": "live",
        }

    async def distribute_reward(
        self,
        *,
        leader_address: str,
        verifier_addresses: list[str],
        amount_blind_wei: int,
        job_id: str,
    ) -> dict[str, Any]:
        """Distribute BLIND reward to quorum nodes after successful inference.

        Distribution: 60% leader, 20% each verifier (assumes 2 verifiers).
        """
        if self.settings.MOCK_CHAIN:
            return {
                "status": "mock",
                "job_id": job_id,
                "distributions": [],
            }

        if not self.settings.BLIND_TOKEN_ADDRESS or self.settings.BLIND_TOKEN_ADDRESS == "0x" + "0" * 40:
            logger.warning("BLIND token address not configured — skipping reward distribution")
            return {
                "status": "skipped",
                "job_id": job_id,
                "reason": "BLIND token address not configured",
            }

        blind = self.web3_client.w3.eth.contract(
            address=Web3.to_checksum_address(self.settings.BLIND_TOKEN_ADDRESS),
            abi=[
                {
                    "constant": False,
                    "inputs": [
                        {"name": "_to", "type": "address"},
                        {"name": "_value", "type": "uint256"},
                    ],
                    "name": "transfer",
                    "outputs": [{"name": "", "type": "bool"}],
                    "payable": False,
                    "stateMutability": "nonpayable",
                    "type": "function",
                },
                {
                    "constant": True,
                    "inputs": [{"name": "_owner", "type": "address"}],
                    "name": "balanceOf",
                    "outputs": [{"name": "balance", "type": "uint256"}],
                    "payable": False,
                    "stateMutability": "view",
                    "type": "function",
                },
            ],
        )

        distributions: list[dict[str, Any]] = []
        total = amount_blind_wei
        leader_amount = int(total * 0.6)
        verifier_amount = int(total * 0.2)

        # Verify wallet has enough BLIND
        wallet_balance = blind.functions.balanceOf(self.web3_client.account.address).call()
        if wallet_balance < total:
            logger.warning(
                "Insufficient BLIND balance for reward distribution: have=%d need=%d",
                wallet_balance,
                total,
            )
            return {
                "status": "failed",
                "job_id": job_id,
                "reason": f"insufficient_balance: have {wallet_balance}, need {total}",
            }

        # Transfer to leader
        try:
            tx = blind.functions.transfer(
                Web3.to_checksum_address(leader_address),
                leader_amount,
            ).build_transaction({
                "from": self.web3_client.account.address,
                "nonce": self.web3_client.w3.eth.get_transaction_count(self.web3_client.account.address),
                "gas": 100_000,
                "gasPrice": int(self.web3_client.w3.eth.gas_price * 1.5),
            })
            signed = self.web3_client.account.sign_transaction(tx)
            tx_hash = self.web3_client.w3.eth.send_raw_transaction(signed.raw_transaction)
            receipt = self.web3_client.w3.eth.wait_for_transaction_receipt(tx_hash)
            distributions.append({
                "node": leader_address,
                "role": "leader",
                "amount_wei": leader_amount,
                "tx_hash": receipt.transactionHash.hex(),
                "status": "success" if receipt.status == 1 else "reverted",
            })
        except Exception as exc:
            logger.error("Leader reward transfer failed for job=%s: %s", job_id, exc)
            distributions.append({
                "node": leader_address,
                "role": "leader",
                "amount_wei": leader_amount,
                "status": "failed",
                "error": str(exc),
            })

        # Transfer to verifiers
        for v_addr in verifier_addresses[:2]:
            try:
                tx = blind.functions.transfer(
                    Web3.to_checksum_address(v_addr),
                    verifier_amount,
                ).build_transaction({
                    "from": self.web3_client.account.address,
                    "nonce": self.web3_client.w3.eth.get_transaction_count(self.web3_client.account.address),
                    "gas": 100_000,
                    "gasPrice": int(self.web3_client.w3.eth.gas_price * 1.5),
                })
                signed = self.web3_client.account.sign_transaction(tx)
                tx_hash = self.web3_client.w3.eth.send_raw_transaction(signed.raw_transaction)
                receipt = self.web3_client.w3.eth.wait_for_transaction_receipt(tx_hash)
                distributions.append({
                    "node": v_addr,
                    "role": "verifier",
                    "amount_wei": verifier_amount,
                    "tx_hash": receipt.transactionHash.hex(),
                    "status": "success" if receipt.status == 1 else "reverted",
                })
            except Exception as exc:
                logger.error("Verifier reward transfer failed for job=%s node=%s: %s", job_id, v_addr, exc)
                distributions.append({
                    "node": v_addr,
                    "role": "verifier",
                    "amount_wei": verifier_amount,
                    "status": "failed",
                    "error": str(exc),
                })

        return {
            "status": "distributed",
            "job_id": job_id,
            "total_amount_wei": total,
            "distributions": distributions,
        }
