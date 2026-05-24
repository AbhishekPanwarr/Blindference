import { ReineiraSDK } from "@reineira-os/sdk";

/**
 * Wraps test USDC into cUSDC by going through a temporary unconditional
 * Reineira escrow: create → fund → redeem.
 *
 * Usage:
 *   npx ts-node scripts/wrap_usdc.ts <amountInUSDC>
 *
 * Environment:
 *   USER_PRIVATE_KEY_TEST   – 0x… private key of the wallet that holds test USDC
 *                              (the same wallet you use in MetaMask for the frontend)
 *   ARBITRUM_SEPOLIA_RPC    – RPC URL for Arbitrum Sepolia
 */

async function main() {
  const privateKey = process.env.USER_PRIVATE_KEY_TEST;
  if (!privateKey) {
    console.error("Set USER_PRIVATE_KEY_TEST environment variable.");
    process.exit(1);
  }

  const amountArg = process.argv[2];
  if (!amountArg) {
    console.error("Usage: npx ts-node scripts/wrap_usdc.ts <amountInUSDC>");
    process.exit(1);
  }
  const usdcAmount = Number(amountArg);
  if (isNaN(usdcAmount) || usdcAmount <= 0) {
    console.error("Amount must be a positive number (e.g. 5)");
    process.exit(1);
  }

  console.log(`Wrapping ${usdcAmount} USDC → cUSDC …`);

  const sdk = ReineiraSDK.create({
    network: "testnet",
    privateKey,
    rpcUrl: process.env.ARBITRUM_SEPOLIA_RPC || process.env.ARBITRUM_SEPOLIA_RPC_URL,
  });

  const amount = sdk.usdc(usdcAmount);
  const owner = sdk.signer.address;

  console.log(`Using wallet: ${owner}`);

  // 1. Create an unconditional escrow
  const escrow = await sdk.escrow.build().amount(amount).owner(owner).create();
  console.log(`Escrow created: id=${escrow.id}`);

  // 2. Fund the escrow – the SDK automatically approves USDC and wraps it into cUSDC
  await escrow.fund(amount, { autoApprove: true });
  console.log("Escrow funded.");

  // 3. Immediately redeem – cUSDC is sent back to your wallet
  await escrow.redeem();
  console.log(`Redeemed. ${usdcAmount} cUSDC is now in wallet ${owner}`);
}

main().catch((e) => {
  console.error("Wrap failed:", e);
  process.exit(1);
});
