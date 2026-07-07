// Deploy the ClauseForge intelligent contract to Bradbury and verify liveness.
//
// Usage: node scripts/deploy.mjs
//
// Reads secrets from `.env` at repo root. Never logs the private key.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createClient, createAccount } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(repoRoot, ".env") });

const ACCOUNT_PRIVATE_KEY = process.env.ACCOUNT_PRIVATE_KEY;
if (!ACCOUNT_PRIVATE_KEY || !ACCOUNT_PRIVATE_KEY.startsWith("0x")) {
  console.error("Missing or malformed ACCOUNT_PRIVATE_KEY in .env.");
  process.exit(1);
}

const FEE_RECIPIENT = process.env.FEE_RECIPIENT?.trim() || "";
const FEE_WEI = BigInt(process.env.FEE_WEI || "0"); // flat fee for compile()

const contractPath = path.join(repoRoot, "contracts", "clauseforge.py");
const contractCode = new Uint8Array(fs.readFileSync(contractPath));

const account = createAccount(ACCOUNT_PRIVATE_KEY);
const client = createClient({ chain: testnetBradbury, account });

console.log("Deployer address :", account.address);
console.log("Chain            :", testnetBradbury.name, "(id", testnetBradbury.id + ")");
console.log("Contract bytes   :", contractCode.length);
console.log("Constructor args :", {
  fee_recipient: FEE_RECIPIENT || "(deployer)",
  fee_wei: FEE_WEI.toString(),
});

await client.initializeConsensusSmartContract();

console.log("\nDeploying...");
const txHash = await client.deployContract({
  code: contractCode,
  args: [FEE_RECIPIENT, FEE_WEI],
});
console.log("Deploy tx hash   :", txHash);

console.log("Waiting for ACCEPTED (usually 1-2 minutes)...");
const receipt = await client.waitForTransactionReceipt({
  hash: txHash,
  status: "ACCEPTED",
  interval: 5_000,
  retries: 240, // ~20 minutes max
});

const contractAddress =
  receipt?.data?.contract_address ||
  receipt?.txDataDecoded?.contractAddress ||
  receipt?.contract_address;

if (!contractAddress) {
  console.error("Deployment did not report a contract address.");
  console.error("Receipt:", JSON.stringify(receipt, null, 2).slice(0, 2000));
  process.exit(1);
}

console.log("Contract address :", contractAddress);
console.log("Explorer         : https://explorer-bradbury.genlayer.com/tx/" + txHash);

// Verify liveness with a view method.
console.log("\nVerifying via view method `config`...");
const cfg = await client.readContract({
  address: contractAddress,
  functionName: "config",
  args: [],
});
console.log("config() ->", cfg);

const artifact = {
  network: "testnet-bradbury",
  chainId: testnetBradbury.id,
  rpc: "https://rpc-bradbury.genlayer.com",
  contractAddress,
  deployTxHash: txHash,
  explorerTx: `https://explorer-bradbury.genlayer.com/tx/${txHash}`,
  explorerContract: `https://explorer-bradbury.genlayer.com/address/${contractAddress}`,
  config: cfg,
  deployedAt: new Date().toISOString(),
};

const outPath = path.join(repoRoot, "deployment.bradbury.json");
fs.writeFileSync(outPath, JSON.stringify(artifact, null, 2) + "\n");
console.log("\nWrote", outPath);
console.log("\nDone.");
