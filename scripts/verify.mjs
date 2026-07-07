// Verify a deployed ClauseForge contract by:
//   1) reading the deploy tx receipt (status + execution result)
//   2) calling the `config` view method against the contract address
//
// Usage:
//   node scripts/verify.mjs [<tx_hash>] [<contract_address>]
//
// If args are omitted, reads them from deployment.bradbury.json at repo root.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(repoRoot, ".env") });

let [, , argTx, argAddr] = process.argv;
if (!argTx || !argAddr) {
  const artifactPath = path.join(repoRoot, "deployment.bradbury.json");
  if (fs.existsSync(artifactPath)) {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    argTx ||= artifact.deployTxHash;
    argAddr ||= artifact.contractAddress;
  }
}
if (!argTx || !argAddr) {
  console.error("Usage: node scripts/verify.mjs <tx_hash> <contract_address>");
  process.exit(1);
}

const client = createClient({ chain: testnetBradbury });

console.log("Deploy tx:", argTx);
console.log("Contract :", argAddr);

const tx = await client.getTransaction({ hash: argTx });
console.log("\nTx status:", tx?.statusName ?? tx?.status);
console.log("Tx execution result:", tx?.txExecutionResultName ?? tx?.tx_execution_result);

console.log("\nCalling config()...");
const cfg = await client.readContract({
  address: argAddr,
  functionName: "config",
  args: [],
});
console.log("config ->", cfg);

console.log("\nCalling count()...");
const count = await client.readContract({
  address: argAddr,
  functionName: "count",
  args: [],
});
console.log("count ->", count);

console.log("\nExplorer:");
console.log("  tx      :", `https://explorer-bradbury.genlayer.com/tx/${argTx}`);
console.log("  contract:", `https://explorer-bradbury.genlayer.com/address/${argAddr}`);
