#!/usr/bin/env ts-node
/**
 * create_escrow.ts
 *
 * Creates and funds a Reineira ConfidentialEscrow for a Blindference inference job.
 *
 * CLI args:
 *   --amount     Job price in cUSDC (6 decimals, e.g. 1000 = $0.001)
 *   --job-id     bytes32 hex string (e.g. 0xabc123...)
 *   --owner      PayoutClaimer address
 *   --resolver   InferenceGate address
 *   --resolver-data  Optional: bytes hex for resolver data (defaults to abi.encode(bytes32(job-id)))
 *
 * Output:
 *   Prints the escrow ID (uint256) as a decimal string to stdout.
 *   All logs go to stderr.
 */

import { ReineiraSDK } from "@reineira-os/sdk";
import { ethers } from "ethers";

function parseArgs(): {
  amount: number;
  jobId: string;
  owner: string;
  resolver: string;
  resolverData?: string;
} {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
  };

  const amount = get("--amount");
  const jobId = get("--job-id");
  const owner = get("--owner");
  const resolver = get("--resolver");
  const resolverData = get("--resolver-data");

  if (!amount || !jobId || !owner || !resolver) {
    console.error(
      "Usage: npx ts-node scripts/create_escrow.ts " +
        "--amount <cUSDC-wei> --job-id <0x...> --owner <addr> --resolver <addr> [--resolver-data <0x...>]"
    );
    process.exit(1);
  }

  return {
    amount: Number(amount),
    jobId,
    owner,
    resolver,
    resolverData,
  };
}

async function main() {
  const { amount, jobId, owner, resolver, resolverData } = parseArgs();

  const privateKey = process.env.ICL_WALLET_PRIVATE_KEY;
  const rpcUrl = process.env.ARBITRUM_SEPOLIA_RPC || process.env.ARBITRUM_SEPOLIA_RPC_URL;

  if (!privateKey) {
    console.error("Missing ICL_WALLET_PRIVATE_KEY env var");
    process.exit(1);
  }
  if (!rpcUrl) {
    console.error("Missing ARBITRUM_SEPOLIA_RPC or ARBITRUM_SEPOLIA_RPC_URL env var");
    process.exit(1);
  }

  console.error("[create_escrow] Initializing Reineira SDK...");
  const sdk = ReineiraSDK.create({
    network: "testnet",
    privateKey,
    rpcUrl,
  });

  // Encode resolver data: InferenceGate expects abi.encode(bytes32(jobId))
  const data = resolverData || ethers.AbiCoder.defaultAbiCoder().encode(["bytes32"], [jobId]);

  console.error(
    `[create_escrow] Building escrow: amount=${amount} cUSDCwei owner=${owner} resolver=${resolver}`
  );

  const escrow = await sdk.escrow
    .build()
    .amount(sdk.usdc(amount))
    .owner(owner)
    .condition(resolver, data)
    .create();

  console.error(`[create_escrow] Escrow created: id=${escrow.id} tx=${escrow.createTx?.hash ?? 'n/a'}`);

  console.error(`[create_escrow] Funding escrow...`);
  const fundResult: any = await escrow.fund(sdk.usdc(amount), { autoApprove: true });
  console.error(
    `[create_escrow] Escrow funded: tx=${fundResult?.hash ?? 'n/a'} block=${fundResult?.blockNumber ?? 'n/a'}`
  );

  // Print only the escrow ID to stdout (decimal)
  console.log(String(escrow.id));
}

main().catch((err) => {
  console.error("[create_escrow] Failed:", err);
  process.exit(1);
});
