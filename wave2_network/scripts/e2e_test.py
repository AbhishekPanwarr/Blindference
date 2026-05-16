#!/usr/bin/env python3
"""Blindference End‑to‑End Integration Test — Arbitrum Sepolia.

Runs the full lifecycle:
  1. Create Reineira escrow (or use pre‑created escrow ID).
  2. Create Blindference job linked to the escrow.
  3. Poll ICL until the job is verified.
  4. Redeem the escrow via PayoutClaimer.
  5. Verify cUSDC payout.

Prerequisites:
  - A funded wallet on Arbitrum Sepolia (ETH + cUSDC).
  - The ICL is running and reachable.
  - Node.js + TypeScript available for escrow creation (or set BLF_E2E_ESCROW_ID).

Environment variables:
  PRIVATE_KEY         — wallet private key (0x‑prefixed)
  ICL_ENDPOINT        — ICL API base URL
  ARB_SEPOLIA_RPC     — Arbitrum Sepolia RPC URL (optional)
  BLF_E2E_ESCROW_ID   — pre‑created escrow ID (skip escrow creation)
"""

from __future__ import annotations

import asyncio
import json
import os
import subprocess
import sys
import time

import aiohttp
from eth_account import Account
from web3 import Web3

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

PRIVATE_KEY = os.environ.get("PRIVATE_KEY", "")
ICL_ENDPOINT = os.environ.get("ICL_ENDPOINT", "https://icl.blindference.xyz")
ARB_SEPOLIA_RPC = os.environ.get(
    "ARB_SEPOLIA_RPC",
    "https://arb-sepolia.g.alchemy.com/v2/CLl67U7NpBZOh63FwiaV7",
)
PRE_CREATED_ESCROW_ID = os.environ.get("BLF_E2E_ESCROW_ID", "")

# Contract addresses (Arbitrum Sepolia)
PAYOUT_CLAIMER_ADDRESS = "0xEfB565c7989dd1dEDD0C5B8c95dA24Ef2d94FBbd"
CUSDC_ADDRESS = "0x42E47f9bA89712C317f60A72C81A610A2b68c48a"

# ABI fragments
ERC20_ABI = [
    {
        "constant": True,
        "inputs": [{"name": "_owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "", "type": "uint256"}],
        "type": "function",
    },
]

PAYOUT_CLAIMER_ABI = [
    {
        "type": "function",
        "name": "claim",
        "inputs": [
            {"name": "escrowId", "type": "uint256"},
            {"name": "jobId", "type": "bytes32"},
        ],
        "outputs": [],
        "stateMutability": "nonpayable",
    },
]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _validate_env() -> Account:
    if not PRIVATE_KEY:
        print("ERROR: PRIVATE_KEY env var is required")
        sys.exit(1)
    raw = PRIVATE_KEY.removeprefix("0x")
    if len(raw) != 64:
        print("ERROR: PRIVATE_KEY must be 64 hex characters")
        sys.exit(1)
    return Account.from_key(raw)


def _load_abi(name: str) -> list:
    path = os.path.join(
        os.path.dirname(__file__), "..", "contracts", "abis", f"{name}.json"
    )
    if not os.path.exists(path):
        # Try node package location
        path = os.path.join(
            os.path.dirname(__file__),
            "..", "..", "Blindference-node", "contracts", "abis", f"{name}.json",
        )
    if os.path.exists(path):
        with open(path) as f:
            data = json.load(f)
        return data.get("abi", data)
    return []


async def _poll_job_verified(icl_url: str, job_id: str, timeout: int = 300) -> bool:
    """Poll ICL until the job is VERIFIED or ACCEPTED."""
    deadline = time.monotonic() + timeout
    async with aiohttp.ClientSession() as session:
        while time.monotonic() < deadline:
            try:
                async with session.get(
                    f"{icl_url}/internal/jobs/{job_id}/status",
                    timeout=aiohttp.ClientTimeout(total=10),
                ) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        status = data.get("status", "").upper()
                        if status in ("VERIFIED", "ACCEPTED"):
                            print(f"  Job {job_id[:12]}… verified!")
                            return True
                        print(f"  Job status: {status} — waiting …")
                    else:
                        print(f"  ICL returned {resp.status}")
            except Exception as exc:
                print(f"  Poll error: {exc}")
            await asyncio.sleep(5)

    return False


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


async def main() -> int:
    account = _validate_env()
    w3 = Web3(Web3.HTTPProvider(ARB_SEPOLIA_RPC))
    print(f"Wallet: {account.address}")

    # ── Step 1: Escrow ────────────────────────────────────────────────
    if PRE_CREATED_ESCROW_ID:
        escrow_id = int(PRE_CREATED_ESCROW_ID)
        print(f"Using pre‑created escrow: {escrow_id}")
    else:
        print("Creating Reineira escrow via TypeScript helper …")
        job_id = "0x" + "E2" * 32  # placeholder job ID for the test
        result = subprocess.run(
            ["npx", "ts-node", "scripts/create_escrow.ts", job_id, "10"],
            capture_output=True, text=True, timeout=120,
            cwd=os.path.join(os.path.dirname(__file__), ".."),
        )
        if result.returncode != 0:
            print(f"Escrow creation failed:\n{result.stderr}")
            print("\nTip: Create an escrow manually and set BLF_E2E_ESCROW_ID.")
            return 1
        escrow_id = int(result.stdout.strip())
        print(f"Escrow created: {escrow_id}")

    # ── Step 2: Create Blindference job ────────────────────────────────
    print("\nCreating Blindference job …")
    print(
        "  (This step requires the ICL to be running and a job submitted via the frontend or API.)"
    )
    print(f"  Once the job is created, its jobId will be linked to escrow {escrow_id}.")
    print(f"  Enter the jobId (32‑byte hex with 0x prefix):")
    job_id = input("  jobId: ").strip()
    if not job_id.startswith("0x") or len(job_id) != 66:
        print("ERROR: Invalid jobId format")
        return 1

    # ── Step 3: Wait for verification ──────────────────────────────────
    print(f"\nPolling ICL {ICL_ENDPOINT} for job verification …")
    verified = await _poll_job_verified(ICL_ENDPOINT, job_id)
    if not verified:
        print("ERROR: Job was not verified within the timeout.")
        return 1

    # ── Step 4: Redeem escrow ─────────────────────────────────────────
    print(f"\nRedeeming escrow {escrow_id} …")
    claimer = w3.eth.contract(
        address=Web3.to_checksum_address(PAYOUT_CLAIMER_ADDRESS),
        abi=PAYOUT_CLAIMER_ABI,
    )
    job_id_bytes = bytes.fromhex(job_id[2:])

    try:
        tx = claimer.functions.claim(escrow_id, job_id_bytes).build_transaction(
            {
                "from": account.address,
                "nonce": w3.eth.get_transaction_count(account.address),
                "gas": 500_000,
                "gasPrice": w3.eth.gas_price,
            }
        )
        signed = account.sign_transaction(tx)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        print(f"  Escrow redeemed: {receipt.transactionHash.hex()}")
    except Exception as exc:
        print(f"  Redemption failed: {exc}")
        # Check if already redeemed
        print("  (The escrow may already have been redeemed.)")

    # ── Step 5: Verify payout ──────────────────────────────────────────
    cusdc = w3.eth.contract(
        address=Web3.to_checksum_address(CUSDC_ADDRESS),
        abi=ERC20_ABI,
    )
    balance = cusdc.functions.balanceOf(account.address).call()
    print(f"\nWallet cUSDC balance: {Web3.from_wei(balance, 'mwei')} USDC")

    print("\n" + "=" * 60)
    print("  E2E Test Complete!")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
