import { ReineiraSDK } from "@reineira-os/sdk";

async function main() {
  const privateKey = process.env.USER_PRIVATE_KEY_TEST;
  const rpcUrl = process.env.ARBITRUM_SEPOLIA_RPC || process.env.ARBITRUM_SEPOLIA_RPC_URL;
  const iclWallet = process.env.ICL_WALLET_ADDRESS || "0x7F9B413Da50e72415b16Eb9df6e5E59774a338dc";
  const amount = Number(process.argv[2] || "1000");

  if (!privateKey) {
    console.error("Set USER_PRIVATE_KEY_TEST env var");
    process.exit(1);
  }

  const sdk = ReineiraSDK.create({
    network: "testnet",
    privateKey,
    rpcUrl,
  });

  console.log(`Creating escrow with owner=${iclWallet} funded by ${sdk.signer.address}`);

  // Create unconditional escrow with ICL wallet as owner
  const escrow = await sdk.escrow
    .build()
    .amount(sdk.usdc(amount))
    .owner(iclWallet)
    .create();

  console.log(`Escrow created: id=${escrow.id}`);

  // Fund with test wallet's USDC
  console.log("Funding escrow...");
  await escrow.fund(sdk.usdc(amount), { autoApprove: true });
  console.log("Escrow funded.");

  // Now the ICL wallet redeems it
  console.log(`Redeeming as ICL wallet ${iclWallet}...`);
  const iclSdk = ReineiraSDK.create({
    network: "testnet",
    privateKey: process.env.ICL_PRIVATE_KEY || process.env.ICL_WALLET_PRIVATE_KEY || "",
    rpcUrl,
  });

  const iclEscrow = iclSdk.escrow.get(escrow.id);
  const result = await iclEscrow.redeem();
  console.log(`Redeemed! Tx: ${result.hash}`);

  // Verify balances
  const { ethers } = await import("ethers");
  const cusdc = new ethers.Contract(
    sdk.addresses.confidentialUSDC,
    ["function balanceOf(address) view returns (uint256)"],
    sdk.signer.provider
  );

  const iclBalance = await cusdc.balanceOf(iclWallet);
  console.log(`ICL wallet cUSDC balance: ${iclBalance}`);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
