import { ReineiraSDK } from "@reineira-os/sdk";
import { ethers } from "ethers";

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  const rpcUrl = process.env.ARBITRUM_SEPOLIA_RPC_URL || "https://arb-sepolia.g.alchemy.com/v2/CLl67U7NpBZOh63FwiaV7";

  if (!privateKey) {
    console.error("Set PRIVATE_KEY env var");
    process.exit(1);
  }

  const sdk = ReineiraSDK.create({
    network: "testnet",
    privateKey,
    rpcUrl,
  });
  await sdk.initialize();

  const ADDRESSES = {
    payoutClaimer: "0xB9b904336F0fC29538e0A0541ABa535372496768",
    resultRegistry: "0xCebd831eCd00915E299b8Ef2666cAbf942dc7150",
    inferenceGate: "0xF3014a79985f83898912cAe2676226310A546905",
  };

  // Test job id
  const jobId = ethers.keccak256(ethers.toUtf8Bytes(`e2e-test-${Date.now()}`));
  const amount = 1000_000000n; // 1000 USDC (6 decimals)

  console.log("═══════════════════════════════════════════");
  console.log("  Full Escrow → Claim E2E Test");
  console.log("═══════════════════════════════════════════");
  console.log("Signer:", sdk.signer.address);
  console.log("PayoutClaimer:", ADDRESSES.payoutClaimer);
  console.log("JobId:", jobId);
  console.log("Amount:", ethers.formatUnits(amount, 6), "cUSDC");
  console.log("");

  // ─── Step 1: Commit result to ResultRegistry ───
  console.log("Step 1 — Commit result to ResultRegistry...");
  const registry = new ethers.Contract(
    ADDRESSES.resultRegistry,
    [
      "function commitResult(bytes32,bytes32,address,address[],uint8,uint8,uint8,bytes32) external",
      "function isConditionMet(bytes32,uint8,uint8) external view returns (bool)",
    ],
    sdk.signer
  );

  const leader = "0x000000000000000000000000000000000000aa01";
  const verifier1 = "0x000000000000000000000000000000000000aa02";
  const verifier2 = "0x000000000000000000000000000000000000aa03";

  const txCommit = await registry.commitResult(
    jobId,
    ethers.keccak256(ethers.toUtf8Bytes("test-result")),
    leader,
    [verifier1, verifier2],
    2, 0, 95, ethers.ZeroHash
  );
  await txCommit.wait();
  console.log("  ✓ Result committed\n");

  // ─── Step 2: Create Reineira escrow ───
  console.log("Step 2 — Create Reineira escrow...");
  console.log("  Building escrow with SDK...");

  // Encode jobId as resolver data
  const resolverData = ethers.AbiCoder.defaultAbiCoder().encode(["bytes32"], [jobId]);

  const vault = await sdk.escrow
    .build()
    .amount(sdk.usdc(Number(amount)))
    .owner(ADDRESSES.payoutClaimer)
    .condition(ADDRESSES.inferenceGate, resolverData)
    .create();

  console.log(`  ✓ Escrow created: id=${vault.id}`);
  console.log(`  createTx: ${vault.createTx?.hash}\n`);

  // ─── Step 3: Fund the escrow ───
  console.log("Step 3 — Fund escrow with cUSDC...");
  const fundResult = await vault.fund(sdk.usdc(Number(amount)), {
    waitForSettlement: true,
  });
  console.log(`  ✓ Escrow funded`);
  console.log(`  fundTx: ${fundResult?.tx?.hash}\n`);

  // ─── Step 4: Call PayoutClaimer.claim() ───
  console.log("Step 4 — Call PayoutClaimer.claim()...");
  const claimer = new ethers.Contract(
    ADDRESSES.payoutClaimer,
    [
      "function claim(uint256 escrowId, bytes32 jobId) external",
      "function escrowToJob(uint256) external view returns (bytes32)",
      "event Claimed(uint256 indexed,bytes32 indexed,address indexed,address,address)",
    ],
    sdk.signer
  );

  const txClaim = await claimer.claim(BigInt(vault.id), jobId, {
    gasLimit: 3000000,
  });
  console.log(`  claim tx: ${txClaim.hash}`);

  const receipt = await txClaim.wait();
  console.log(`  ✓ Claim ${receipt?.status === 1 ? 'SUCCEEDED' : 'FAILED'}`);
  console.log(`  gas used: ${receipt?.gasUsed}\n`);

  // Parse Claimed event
  const event = receipt?.logs
    .map((log: any) => {
      try { return claimer.interface.parseLog(log); } catch { return null; }
    })
    .find((parsed: any) => parsed?.name === "Claimed");

  if (event) {
    console.log("  Claimed event:");
    console.log(`    escrowId: ${event.args[0]}`);
    console.log(`    jobId: ${event.args[1]}`);
    console.log(`    leader: ${event.args[2]}`);
    console.log(`    verifier1: ${event.args[3]}`);
    console.log(`    verifier2: ${event.args[4]}\n`);
  }

  // ─── Step 5: Verify balances ───
  console.log("Step 5 — Verify cUSDC balances...");
  const cusdc = new ethers.Contract(
    sdk.addresses.confidentialUSDC,
    ["function balanceOf(address) view returns (uint256)"],
    sdk.signer.provider
  );

  const [leaderBal, v1Bal, v2Bal] = await Promise.all([
    cusdc.balanceOf(leader),
    cusdc.balanceOf(verifier1),
    cusdc.balanceOf(verifier2),
  ]);

  console.log(`  Leader:    ${ethers.formatUnits(leaderBal, 6)} cUSDC`);
  console.log(`  Verifier1: ${ethers.formatUnits(v1Bal, 6)} cUSDC`);
  console.log(`  Verifier2: ${ethers.formatUnits(v2Bal, 6)} cUSDC`);

  const totalDistributed = leaderBal + v1Bal + v2Bal;
  console.log(`  Total distributed: ${ethers.formatUnits(totalDistributed, 6)} cUSDC`);
  console.log(`  Expected: ${ethers.formatUnits(amount, 6)} cUSDC`);
  console.log(`  Match: ${totalDistributed === amount ? '✓ YES' : '✗ NO (rounding expected)'}\n`);

  console.log("═══════════════════════════════════════════");
  console.log("  E2E TEST COMPLETE");
  console.log("═══════════════════════════════════════════");
}

main().catch((err) => {
  console.error("E2E test failed:", err);
  process.exit(1);
});
