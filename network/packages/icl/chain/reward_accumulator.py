from __future__ import annotations

from eth_abi import encode
from chain.web3_client import Web3Client
from config import Settings


class RewardAccumulatorClient:
    def __init__(self, web3_client: Web3Client, settings: Settings):
        self.web3_client = web3_client
        self.settings = settings
        self.address = web3_client.checksum_address(settings.REWARD_ACCUMULATOR_ADDRESS)

    def is_deployed(self) -> bool:
        return self.web3_client.code_exists(self.address)

    def accrue(
        self,
        node_address: str,
        cycle_epoch: int,
        escrow_id: int,
        role: int,
        amount_wei: int,
        work_ref: str,
    ) -> dict[str, str]:
        """Call RewardAccumulator.accrue() for a single node work item.

        *role* should be 0 (EXECUTOR / leader), 1 (CROSS_VERIFIER), or 2 (ARBITER).
        *work_ref* is a bytes32 hex string (e.g. the job_id padded to 32 bytes).
        """
        contract = self.web3_client.w3.eth.contract(
            address=self.address,
            abi=[
                {
                    "inputs": [
                        {"name": "node", "type": "address"},
                        {"name": "cycleEpoch", "type": "uint64"},
                        {"name": "escrowId", "type": "uint256"},
                        {"name": "role", "type": "uint8"},
                        {"name": "amount", "type": "uint256"},
                        {"name": "workRef", "type": "bytes32"},
                    ],
                    "name": "accrue",
                    "outputs": [],
                    "stateMutability": "nonpayable",
                    "type": "function",
                }
            ],
        )
        tx = contract.functions.accrue(
            self.web3_client.checksum_address(node_address),
            cycle_epoch,
            escrow_id,
            role,
            amount_wei,
            self.web3_client.ensure_hex_prefix(work_ref),
        ).build_transaction({
            "from": self.web3_client.account.address,
            "nonce": self.web3_client.w3.eth.get_transaction_count(self.web3_client.account.address, "pending"),
            "gas": 150_000,
            "gasPrice": int(self.web3_client.w3.eth.gas_price * 1.5),
        })
        signed = self.web3_client.account.sign_transaction(tx)
        tx_hash = self.web3_client.w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = self.web3_client.w3.eth.wait_for_transaction_receipt(tx_hash)
        return {
            "tx_hash": receipt.transactionHash.hex(),
            "status": "success" if receipt.status == 1 else "reverted",
        }
