/**
 * Create a Reineira escrow linked to a Blindference job.
 *
 * Usage:
 *   npx ts-node scripts/create_escrow.ts <jobId> <amountUsdc>
 *
 * Env vars:
 *   PRIVATE_KEY     — deployer wallet private key
 *   ARB_SEPOLIA_RPC — Arbitrum Sepolia RPC URL (optional)
 */

import { ReineiraSDK } from "@reineira-os/sdk"
import { ethers } from "ethers"

const INFERENCE_GATE = "0xF3014a79985f83898912cAe2676226310A546905"
const PAYOUT_CLAIMER = "0xEfB565c7989dd1dEDD0C5B8c95dA24Ef2d94FBbd"

async function main() {
  const [jobId, amountStr] = process.argv.slice(2)
  if (!jobId || !amountStr) {
    console.error("Usage: npx ts-node create_escrow.ts <jobId> <amountUsdc>")
    process.exit(1)
  }

  const privateKey = process.env.PRIVATE_KEY
  if (!privateKey) {
    console.error("PRIVATE_KEY env var required")
    process.exit(1)
  }

  const amount = parseFloat(amountStr)
  if (isNaN(amount) || amount <= 0) {
    console.error("amountUsdc must be a positive number")
    process.exit(1)
  }

  // Ensure 0x prefix and 64 hex chars
  const normalizedJobId = jobId.startsWith("0x") ? jobId : `0x${jobId}`
  if (normalizedJobId.length !== 66) {
    console.error("jobId must be 32 bytes (64 hex chars)")
    process.exit(1)
  }

  const sdk = ReineiraSDK.create({
    network: "testnet",
    privateKey,
  })
  await sdk.initialize()

  console.log(`Creating escrow for job ${normalizedJobId} …`)

  // NOTE: Reineira SDK's `.condition()` expects the resolver address + bytes data.
  // The resolverData is abi.encode(jobId) passed to InferenceGate.onConditionSet().
  const vault = await sdk.escrow
    .build()
    .amount(sdk.usdc(amount))
    .owner(PAYOUT_CLAIMER)
    .condition(
      INFERENCE_GATE,
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32"],
        [normalizedJobId]
      )
    )
    .create()

  console.log(`Escrow created: ${vault.id}`)

  // Fund the escrow
  console.log(`Funding escrow ${vault.id} with ${amount} USDC …`)
  await vault.fund(sdk.usdc(amount))
  console.log(`Escrow ${vault.id} funded`)

  // Output the escrow ID for the e2e test
  process.stdout.write(`${vault.id}\n`)
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
