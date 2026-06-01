import { ReineiraSDK } from "@reineira-os/sdk";
const sdk = ReineiraSDK.create({ network: "testnet" });
console.log("cUSDC:", sdk.addresses.confidentialUSDC);
console.log("Escrow:", sdk.addresses.confidentialEscrow);
console.log("All:", JSON.stringify(sdk.addresses, null, 2));
