// Accept-only helper: party_a signs `accept_terms` for a given agreement id.
// Usage: node scripts/accept.mjs <agreement_id>

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createClient, createAccount } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(repoRoot, ".env") });

const artifact = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "deployment.bradbury.json"), "utf8"),
);
const CONTRACT = artifact.contractAddress;

const id = Number(process.argv[2]);
if (!id) {
  console.error("Usage: node scripts/accept.mjs <id>");
  process.exit(1);
}

const account = createAccount(process.env.ACCOUNT_PRIVATE_KEY);
const client = createClient({ chain: testnetBradbury, account });

const ag = await client.readContract({
  address: CONTRACT,
  functionName: "get_agreement",
  args: [id],
});
if (!ag.compiled_terms_hash) {
  console.error("agreement has no compiled_terms_hash; cannot accept");
  process.exit(1);
}

const hash = await client.writeContract({
  address: CONTRACT,
  functionName: "accept_terms",
  args: [id, ag.compiled_terms_hash],
  value: 0n,
});
console.log("accept tx:", hash);
const r = await client.waitForTransactionReceipt({
  hash,
  status: "ACCEPTED",
  interval: 5_000,
  retries: 240,
});
console.log("status:", r?.statusName, "exec:", r?.txExecutionResultName);

const after = await client.readContract({
  address: CONTRACT,
  functionName: "get_agreement",
  args: [id],
});
console.log("after: accepted_a =", after.accepted_a, "status =", after.status);
