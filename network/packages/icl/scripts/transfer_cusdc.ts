import { ReineiraSDK } from "@reineira-os/sdk";

async function main() {
  const privateKey = process.env.USER_PRIVATE_KEY_TEST;
  const rpcUrl = process.env.ARBITRUM_SEPOLIA_RPC || process.env.ARBITRUM_SEPOLIA_RPC_URL;
  const toAddress = process.env.TO_ADDRESS;
  const amount = Number(process.argv[2] || "1000");

  if (!privateKey) {
    console.error("Set USER_PRIVATE_KEY_TEST env var");
    process.exit(1);
  }
  if (!toAddress) {
    console.error("Set TO_ADDRESS env var");
    process.exit(1);
  }

  const sdk = ReineiraSDK.create({
    network: "testnet",
    privateKey,
    rpcUrl,
  });

  console.log(`Transferring ${amount} cUSDC from ${sdk.signer.address} to ${toAddress}...`);

  // Get the cUSDC contract address from the SDK
  const cusdcAddress = sdk.addresses.confidentialUSDC;
  console.log(`cUSDC address: ${cusdcAddress}`);

  // Use ethers directly for the transfer
  const { ethers } = await import("ethers");
  const cusdc = new ethers.Contract(
    cusdcAddress,
    [
      "function confidentialTransfer(address to, uint256 value) returns (uint256 transferred)",
      "function balanceOf(address account) view returns (uint256)",
    ],
    sdk.signer
  );

  const balance = await cusdc.balanceOf(sdk.signer.address);
  console.log(`Sender balance: ${balance}`);

  // The value needs to be an FHE-encrypted value. Let's try with a plaintext uint256
  // and see if the contract handles it internally.
  const tx = await cusdc.confidentialTransfer(toAddress, amount, {
    gasLimit: 2000000,
  });
  console.log(`Tx hash: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`Receipt: ${receipt.status === 1 ? 'success' : 'failed'}`);
}

main().catch((err) => {
  console.error("Transfer failed:", err);
  process.exit(1);
});
