from __future__ import annotations

import argparse
import asyncio
import logging
from pathlib import Path

import httpx
import uvicorn


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="blindference-node", description="Run a Blindference protocol node.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    init_parser = subparsers.add_parser("init", help="Initialize local node state.")
    init_parser.add_argument("--data-dir", default=str(Path.home() / ".blindference"))

    subparsers.add_parser("start", help="Start the demo worker.")
    subparsers.add_parser("status", help="Show runtime configuration.")

    jobs_parser = subparsers.add_parser("jobs", help="List recent jobs.")
    jobs_parser.add_argument("--limit", type=int, default=10)

    earnings_parser = subparsers.add_parser("earnings", help="Show total earnings.")

    staking_parser = subparsers.add_parser("staking", help="Staking commands.")
    staking_subparsers = staking_parser.add_subparsers(dest="staking_command")
    staking_subparsers.add_parser("status", help="Show staking status.")

    subparsers.add_parser("dashboard", help="Print node dashboard summary.")

    attest_parser = subparsers.add_parser("attest", help="Print a placeholder attestation action.")
    attest_parser.add_argument("attestation_type")
    attest_parser.add_argument("--document", required=True)
    attest_parser.add_argument("--counterparty", default="0x0000000000000000000000000000000000000000")
    attest_parser.add_argument("--expires-at", type=int, default=0)
    return parser


def _print_table(headers: list[str], rows: list[list[str]]) -> None:
    """Print a simple ASCII table."""
    col_widths = [max(len(str(h)), *(len(str(r[i])) for r in rows)) for i, h in enumerate(headers)]
    sep = "+-" + "-+-".join("-" * w for w in col_widths) + "-+"
    print(sep)
    print("| " + " | ".join(h.ljust(w) for h, w in zip(headers, col_widths)) + " |")
    print(sep)
    for row in rows:
        print("| " + " | ".join(str(v).ljust(w) for v, w in zip(row, col_widths)) + " |")
    print(sep)


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )
    parser = build_parser()
    args = parser.parse_args()

    if args.command == "init":
        data_dir = Path(args.data_dir)
        data_dir.mkdir(parents=True, exist_ok=True)
        print(f"Initialized node data directory at {data_dir}")
        print("Set BLINDFERENCE_NODE_* env vars, then run `blindference-node start`.")
        return

    if args.command == "status":
        from blindference_node.config import NodeSettings

        settings = NodeSettings()
        print(f"ICL: {settings.icl_base_url}")
        print(f"Payment Service: {settings.payment_service_url}")
        print(f"Provider: {settings.provider}")
        print(f"Mock mode: {settings.mock_cloud_inference}")
        return

    if args.command in ("jobs", "earnings", "staking", "dashboard"):
        from blindference_node.config import NodeSettings
        from blindference_node.api_client import PaymentServiceClient

        settings = NodeSettings()
        if not settings.operator_private_key:
            print("Error: BLINDFERENCE_NODE_OPERATOR_PRIVATE_KEY must be set.")
            return

        client = PaymentServiceClient(settings)

        if args.command == "jobs":
            result = asyncio.run(client.get_jobs(limit=args.limit))
            jobs = result.get("jobs", [])
            if not jobs:
                print("No jobs found.")
                return
            rows = [
                [
                    j["job_id"][:16] + "..." if len(j["job_id"]) > 16 else j["job_id"],
                    j["role"],
                    j["status"],
                    j.get("model_id", "")[:20],
                    str(j.get("amount_blind_earned", "—")),
                ]
                for j in jobs
            ]
            _print_table(["Job ID", "Role", "Status", "Model", "BLIND"], rows)
            return

        if args.command == "earnings":
            result = asyncio.run(client.get_stats())
            earned = result.get("total_earned_blind", "0")
            total_jobs = result.get("total_jobs", 0)
            print(f"Total earned: {earned} BLIND")
            print(f"Jobs completed: {total_jobs}")
            return

        if args.command == "staking":
            if args.staking_command == "status":
                result = asyncio.run(client.get_stats())
                stake = result.get("current_stake_blind", "0")
                failures = result.get("slash_count", 0)
                slashed = result.get("slashed", False)
                print(f"Current stake: {stake} BLIND")
                print(f"Consecutive failures: {failures} / 3")
                if slashed:
                    print("⚠️  SLASHED — consecutive failures >= 3")
            else:
                print("Usage: blindference-node staking status")
            return

        if args.command == "dashboard":
            result = asyncio.run(client.get_stats())
            total_jobs = result.get("total_jobs", 0)
            success = result.get("success", 0)
            failed = result.get("failed", 0)
            stake = result.get("current_stake_blind", "0")
            earned = result.get("total_earned_blind", "0")
            slashed = result.get("slashed", False)

            print("┌─────────────────────────────────────────┐")
            print("│        Blindference Node Dashboard      │")
            print("├─────────────────────────────────────────┤")
            print(f"│ Status:      {'Active' if total_jobs > 0 else 'Idle'}")
            print(f"│ Stake:       {stake} BLIND")
            print(f"│ Total Jobs:  {total_jobs} ({success} success, {failed} failed)")
            print(f"│ Earned:      {earned} BLIND")
            if slashed:
                print("│ ⚠️  SLASHED — consecutive failures >= 3")
            print("└─────────────────────────────────────────┘")
            return

    if args.command == "start":
        from blindference_node.config import NodeSettings
        from blindference_node.server import create_node_app
        from blindference_node.worker import BlindferenceDemoWorker

        settings = NodeSettings()
        if not settings.operator_private_key:
            raise RuntimeError("BLINDFERENCE_NODE_OPERATOR_PRIVATE_KEY must be set for event-driven runtime mode.")

        worker = BlindferenceDemoWorker(settings)
        callback_url = settings.callback_public_url or f"http://{settings.callback_host}:{settings.callback_port}"
        operator_address = worker.cofhe_bridge.operator_address if worker.cofhe_bridge else "unknown"

        print(f"Connecting to ICL at {settings.icl_base_url}")
        print(
            f"Using provider={settings.provider} model="
            f"{settings.groq_model if settings.provider.lower() == 'groq' else settings.gemini_model}"
        )
        print(f"Operator address={operator_address}")
        print(f"Callback URL={callback_url}")
        if settings.mock_cloud_inference:
            print("Mock cloud inference is enabled for local Anvil demos.")

        async def run_event_driven_runtime() -> None:
            app = create_node_app(worker)
            config = uvicorn.Config(
                app,
                host=settings.callback_host,
                port=settings.callback_port,
                log_level="warning",
            )
            server = uvicorn.Server(config)

            async def register_runtime() -> None:
                await asyncio.sleep(0.5)
                async with httpx.AsyncClient(base_url=settings.icl_base_url, timeout=10.0) as client:
                    response = await client.post(
                        "/internal/operators/runtime",
                        json={
                            "operator_address": operator_address,
                            "callback_url": callback_url,
                        },
                    )
                    response.raise_for_status()
                    print(f"Registered node runtime: {response.json()}")

            server_task = asyncio.create_task(server.serve())
            worker_task = asyncio.create_task(worker.run())
            register_task = asyncio.create_task(register_runtime())
            try:
                await asyncio.gather(server_task, worker_task, register_task)
            finally:
                server.should_exit = True

        asyncio.run(run_event_driven_runtime())
        return

    print(
        f"Would publish attestation type={args.attestation_type} doc={args.document} "
        f"counterparty={args.counterparty} expires_at={args.expires_at}"
    )
    print("Attestation publish remains a placeholder in this demo worker.")


if __name__ == "__main__":
    main()
