from __future__ import annotations

import asyncio
import json
import logging
import re
from pathlib import Path

from eth_account import Account


logger = logging.getLogger("blindference.node.cofhe_bridge")


class CofheBridgeError(RuntimeError):
    pass


class CofheBridgeClient:
    """Persistent CoFHE bridge client.

    Spawns the Node.js bridge process once and keeps it alive across
    multiple operations.  This eliminates the ~10-30 second cold-start
    cost (module loading + CoFHE client handshake) on every decrypt or
    encrypt call.

    Communication is line-delimited JSON over stdin/stdout.  stderr is
    drained in a background coroutine so the pipe never fills and blocks
    the Node process.
    """

    def __init__(self, *, script_path: str, rpc_url: str, chain_id: int, private_key: str):
        self.script_path = script_path
        self.rpc_url = rpc_url
        self.chain_id = chain_id
        self.private_key = self._normalize_private_key(private_key)
        self.operator_address = Account.from_key(self.private_key).address

        self._process: asyncio.subprocess.Process | None = None
        self._lock = asyncio.Lock()
        self._req_counter = 0
        self._closed = False
        self._stderr_drain_task: asyncio.Task | None = None

    # ------------------------------------------------------------------
    # Public API (unchanged signatures)
    # ------------------------------------------------------------------

    async def decrypt_for_view(self, *, encrypted_features: list[dict], permit: str) -> list[int]:
        payload = {
            "action": "decrypt_for_view",
            "rpcUrl": self.rpc_url,
            "chainId": self.chain_id,
            "privateKey": self.private_key,
            "permit": permit,
            "features": [
                {
                    "ctHash": str(feature.get("ct_hash") or feature.get("ctHash")),
                    "utype": feature.get("utype"),
                }
                for feature in encrypted_features
            ],
        }
        result = await self._run(payload)
        return [int(value) for value in result["values"]]

    async def decrypt_prompt_key(self, *, high_handle: str, low_handle: str) -> bytes:
        payload = {
            "action": "decrypt_prompt_key",
            "rpcUrl": self.rpc_url,
            "chainId": self.chain_id,
            "privateKey": self.private_key,
            "highHandle": str(high_handle),
            "lowHandle": str(low_handle),
        }
        result = await self._run(payload)
        high = int(result["high"])
        low = int(result["low"])
        return high.to_bytes(16, "big") + low.to_bytes(16, "big")

    async def encrypt_uint128_values(self, *, values: list[int]) -> list[dict]:
        payload = {
            "action": "encrypt_uint128",
            "rpcUrl": self.rpc_url,
            "chainId": self.chain_id,
            "privateKey": self.private_key,
            "values": [str(value) for value in values],
        }
        result = await self._run(payload)
        return list(result["results"])

    async def store_prompt_key(
        self,
        *,
        task_id: str,
        prompt_key_store_address: str,
        encrypted_high_input: dict,
        encrypted_low_input: dict,
        allowed_nodes: list[str],
    ) -> str:
        payload = {
            "action": "store_prompt_key",
            "rpcUrl": self.rpc_url,
            "chainId": self.chain_id,
            "privateKey": self.private_key,
            "taskId": task_id,
            "promptKeyStoreAddress": prompt_key_store_address,
            "encryptedHighInput": encrypted_high_input,
            "encryptedLowInput": encrypted_low_input,
            "allowedNodes": allowed_nodes,
        }
        result = await self._run(payload)
        return str(result["txHash"])

    async def close(self) -> None:
        """Terminate the persistent bridge process."""
        self._closed = True
        if self._stderr_drain_task is not None:
            self._stderr_drain_task.cancel()
            try:
                await self._stderr_drain_task
            except asyncio.CancelledError:
                pass
        if self._process is not None:
            try:
                self._process.terminate()
                await asyncio.wait_for(self._process.wait(), timeout=5.0)
            except Exception:
                pass
            try:
                self._process.kill()
            except Exception:
                pass
            self._process = None

    # ------------------------------------------------------------------
    # Internal – persistent subprocess
    # ------------------------------------------------------------------

    async def _ensure_process(self) -> asyncio.subprocess.Process:
        if self._process is not None and self._process.returncode is None:
            return self._process

        if self._closed:
            raise CofheBridgeError("CofheBridgeClient has been closed")

        # Cancel old stderr drain if restarting
        if self._stderr_drain_task is not None and not self._stderr_drain_task.done():
            self._stderr_drain_task.cancel()
            try:
                await self._stderr_drain_task
            except asyncio.CancelledError:
                pass

        self._process = await asyncio.create_subprocess_exec(
            "node",
            self.script_path,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=str(Path(self.script_path).resolve().parent.parent),
        )
        self._stderr_drain_task = asyncio.create_task(self._drain_stderr())
        logger.info("CoFHE bridge process started (pid=%s)", self._process.pid)
        return self._process

    async def _drain_stderr(self) -> None:
        """Read stderr continuously so the pipe never fills and blocks the child."""
        process = self._process
        if process is None or process.stderr is None:
            return
        try:
            while True:
                line = await process.stderr.readline()
                if not line:
                    break
                decoded = line.decode("utf-8", errors="replace").rstrip()
                if decoded:
                    logger.debug("CoFHE bridge stderr: %s", decoded)
        except Exception:
            pass

    async def _read_response_line(self) -> str:
        """Read a single newline-terminated JSON line from stdout."""
        process = await self._ensure_process()
        if process.stdout is None:
            raise CofheBridgeError("CoFHE bridge stdout pipe is missing")

        buffer = bytearray()
        while True:
            byte = await process.stdout.read(1)
            if not byte:
                # EOF – process probably died
                if self._process is not None and self._process.returncode is not None:
                    raise CofheBridgeError(
                        f"CoFHE bridge process exited with code {self._process.returncode}"
                    )
                raise CofheBridgeError("CoFHE bridge stdout closed unexpectedly")
            if byte == b"\n":
                break
            buffer.extend(byte)

        return buffer.decode("utf-8")

    async def _run(self, payload: dict) -> dict:
        async with self._lock:
            self._req_counter += 1
            request_id = self._req_counter
            payload = {**payload, "_requestId": request_id}

            process = await self._ensure_process()
            if process.stdin is None:
                raise CofheBridgeError("CoFHE bridge stdin pipe is missing")

            # Write command + newline
            line = json.dumps(payload) + "\n"
            process.stdin.write(line.encode("utf-8"))
            await process.stdin.drain()

            # Read response line
            raw = await self._read_response_line()
            if not raw.strip():
                raise CofheBridgeError("CoFHE bridge produced no output")

            try:
                response = json.loads(raw)
            except json.JSONDecodeError as exc:
                raise CofheBridgeError(f"Invalid JSON from CoFHE bridge: {raw[:200]}...") from exc

            if not response.get("ok"):
                raise CofheBridgeError(response.get("error") or "CoFHE bridge failed")

            return response

    @staticmethod
    def _normalize_private_key(private_key: str) -> str:
        normalized = private_key.strip().strip("\"'")
        if normalized.startswith(("0x", "0X")):
            normalized = normalized[2:]
        if len(normalized) != 64:
            raise CofheBridgeError(f"Invalid operator private key length: expected 64 hex chars, got {len(normalized)}")
        if not re.fullmatch(r"[0-9a-fA-F]{64}", normalized):
            raise CofheBridgeError("Invalid operator private key: expected only hexadecimal characters")
        return f"0x{normalized.lower()}"
