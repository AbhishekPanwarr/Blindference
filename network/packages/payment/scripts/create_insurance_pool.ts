/**
 * create_insurance_pool.ts
 * 
 * One-time setup script to create a Reineira insurance pool and register the policy adapter.
 * 
 * Usage:
 *   PRIVATE_KEY=0x... POLICY_ADAPTER_ADDRESS=0x... npx ts-node scripts/create_insurance_pool.ts
 */

import { ReineiraSDK } from "@reineira-os/sdk";

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  const policyAdapterAddress = process.env.POLICY_ADAPTER_ADDRESS;

  if (!privateKey || !policyAdapterAddress) {
    console.error("Missing PRIVATE_KEY or POLICY_ADAPTER_ADDRESS env vars");
    process.exit(1);
  }

  console.log("[create_insurance_pool] Initializing Reineira SDK...");
  const sdk = ReineiraSDK.create({
    network: "testnet",
    privateKey,
    rpcUrl: process.env.ARBITRUM_SEPOLIA_RPC || "https://sepolia-rollup.arbitrum.io/rpc",
  });

  // Initialize FHE (required for insurance operations)
  try {
    await sdk.initialize();
    console.log("[create_insurance_pool] SDK initialized");
  } catch (err) {
    console.error("[create_insurance_pool] SDK init failed:", err);
    // Continue anyway - pool creation might still work
  }

  console.log("[create_insurance_pool] Creating insurance pool...");
  
  try {
    const pool = await sdk.insurance.createPool({
      paymentToken: sdk.addresses.confidentialUSDC,
    });
    
    console.log(`[create_insurance_pool] Pool created: id=${pool.id}, address=${pool.address}`);

    console.log("[create_insurance_pool] Adding policy adapter to pool...");
    await pool.addPolicy(policyAdapterAddress);
    console.log("[create_insurance_pool] Policy added successfully");

    console.log("\n=== POOL DETAILS ===");
    console.log(`POOL_ID=${pool.id}`);
    console.log(`POOL_ADDRESS=${pool.address}`);
    console.log("====================\n");
  } catch (err) {
    console.error("[create_insurance_pool] Failed:", err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[create_insurance_pool] Unhandled error:", err);
  process.exit(1);
});
