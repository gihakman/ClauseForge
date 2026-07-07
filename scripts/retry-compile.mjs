// Retry compile_agreement for a specific agreement id until it lands in COMPILED.
// Usage: node scripts/retry-compile.mjs <agreement_id>

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
  console.error("Usage: node scripts/retry-compile.mjs <id>");
  process.exit(1);
}

const account = createAccount(process.env.ACCOUNT_PRIVATE_KEY);
const client = createClient({ chain: testnetBradbury, account });

let ag = await client.readContract({
  address: CONTRACT,
  functionName: "get_agreement",
  args: [id],
});
console.log(`start: id=${id} status=${ag.status} hash=${ag.compiled_terms_hash || "-"}`);

for (let attempt = 1; attempt <= 3 && ag.status === "DRAFT"; attempt++) {
  console.log(`\nattempt ${attempt}: compile_agreement(${id})`);
  const hash = await client.writeContract({
    address: CONTRACT,
    functionName: "compile_agreement",
    args: [id],
    value: 0n,
  });
  console.log("  tx:", hash);
  const r = await client.waitForTransactionReceipt({
    hash,
    status: "ACCEPTED",
    interval: 5_000,
    retries: 240,
  });
  console.log("  status:", r?.statusName, "exec:", r?.txExecutionResultName);

  ag = await client.readContract({
    address: CONTRACT,
    functionName: "get_agreement",
    args: [id],
  });
  console.log(`  after: status=${ag.status} clear=${ag.clear_to_commit} risk=${ag.risk_score} ambig=${ag.ambiguity_count} hash=${ag.compiled_terms_hash || "-"}`);

  if (ag.status === "COMPILED" && ag.compiled_terms_hash) {
    console.log("\naccept_terms as party_a...");
    const acceptHash = await client.writeContract({
      address: CONTRACT,
      functionName: "accept_terms",
      args: [id, ag.compiled_terms_hash],
      value: 0n,
    });
    console.log("  tx:", acceptHash);
    const ar = await client.waitForTransactionReceipt({
      hash: acceptHash,
      status: "ACCEPTED",
      interval: 5_000,
      retries: 240,
    });
    console.log("  status:", ar?.statusName, "exec:", ar?.txExecutionResultName);
    break;
  }
}

const final = await client.readContract({
  address: CONTRACT,
  functionName: "get_agreement",
  args: [id],
});
console.log("\nfinal state:", {
  id: final.id,
  status: final.status,
  clear_to_commit: final.clear_to_commit,
  risk_score: final.risk_score,
  risk_bucket: final.risk_bucket,
  ambiguity_count: final.ambiguity_count,
  hash: final.compiled_terms_hash,
  accepted_a: final.accepted_a,
});
