// Seed 4 real end-to-end example agreements against a deployed ClauseForge
// contract on Bradbury. Each example:
//   1) creates an agreement with the deployer as party_a
//   2) runs `compile_agreement` on live validators (real LLM + web consensus)
//   3) has party_a `accept_terms` on the compiled hash
//
// party_b is a stable placeholder address per example. Users of the app can
// complete the two-sided activation themselves via the Interactive Console.
//
// Compile transactions can take a while because they hit real LLMs. This
// script polls patiently. It is safe to re-run: seeds a fresh set each time.

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

const KEY = process.env.ACCOUNT_PRIVATE_KEY;
if (!KEY || !KEY.startsWith("0x")) {
  console.error("Missing or malformed ACCOUNT_PRIVATE_KEY in .env.");
  process.exit(1);
}

const account = createAccount(KEY);
const client = createClient({ chain: testnetBradbury, account });

// Deterministic placeholder party_b addresses (unfunded; used only as
// counterparty labels for the seeded examples).
const PARTY_B_TECH  = "0x2Bd806c97F0e00aF1a1FC3328fA763A9269723C8";
const PARTY_B_DESIGN = "0x81b637d8fcd2c6da6359e6963113a1170de795e4";
const PARTY_B_RESEARCH = "0x9c9dfdd67f08cd82c25dfb2bf683b1af5d640a90";
const PARTY_B_WEB = "0xE72d97bC44c58f79F5B0Ee7Ba0d24a12ed08b7fC";

const examples = [
  {
    tag: "1 - Clear: technical audit",
    party_b: PARTY_B_TECH,
    title: "Solidity audit of Merkle proof helper",
    draft:
      "Party A engages Party B to perform a security audit of the file " +
      "contracts/MerkleProof.sol at commit 3f2a1c9. Deliverable: a written " +
      "audit report in Markdown covering (a) storage safety, (b) integer " +
      "overflow paths, (c) reentrancy surface. Deadline: report delivered " +
      "no later than 2026-09-01 23:59 UTC. Payment: 1,500 USDC on Base, " +
      "released within 3 business days of Party A's acceptance. " +
      "Acceptance criteria: Party A must review and either accept the " +
      "report or file specific written objections within 5 business days " +
      "of receipt; silence past that window is deemed acceptance. " +
      "Revision policy: one round of revisions within 3 business days if " +
      "objections are filed.",
    evidence_urls: [],
  },
  {
    tag: "2 - Ambiguous: freelance website",
    party_b: PARTY_B_DESIGN,
    title: "Make me a landing page",
    draft:
      "Party B will make a landing page for Party A. Should look modern " +
      "and clean. Delivery soon. Payment when done. Feedback rounds if " +
      "needed. Party A may request changes.",
    evidence_urls: [],
  },
  {
    tag: "3 - Research memo",
    party_b: PARTY_B_RESEARCH,
    title: "Research memo: Optimistic Democracy vs bonded rollups",
    draft:
      "Party B agrees to deliver a 6 to 8 page research memo comparing " +
      "Optimistic Democracy consensus and bonded rollup fraud proof " +
      "systems, structured as: (1) threat model, (2) validator " +
      "incentives, (3) failure modes, (4) references. Deadline: 2026-10-01. " +
      "Payment: 2,000 USDC on delivery. Acceptance criteria: Party A must " +
      "either accept the memo or provide specific written revision " +
      "requests within 7 days. Revision policy: up to two rounds of " +
      "revisions, 5 business days each, at no extra cost.",
    evidence_urls: [],
  },
  {
    tag: "4 - Agent-to-agent task",
    party_b: PARTY_B_WEB,
    title: "PR review by agent",
    draft:
      "Agent A commits Agent B to review pull request #142 on the " +
      "example.com/repo project. Deliverable: written review with " +
      "actionable comments on correctness, tests, and style. Deadline: " +
      "within 24 hours of assignment. Payment: 10 USDC on acceptance. " +
      "Acceptance criteria: review is considered accepted when Agent A " +
      "either merges the PR or closes the review thread. Revision " +
      "policy: none.",
    evidence_urls: [],
  },
];

async function waitAccepted(hash, label) {
  console.log(`  waiting for ACCEPTED (${label})...`);
  const r = await client.waitForTransactionReceipt({
    hash,
    status: "ACCEPTED",
    interval: 5_000,
    retries: 240,
  });
  const exec = r?.txExecutionResultName ?? r?.tx_execution_result ?? "n/a";
  console.log(`  ${label} -> status=ACCEPTED exec=${exec}`);
  if (exec === "FINISHED_WITH_ERROR") {
    console.error("  execution failed on-chain; aborting example");
    throw new Error("on-chain execution error");
  }
  return r;
}

async function currentCount() {
  const n = await client.readContract({
    address: CONTRACT,
    functionName: "count",
    args: [],
  });
  return Number(n);
}

console.log("Contract      :", CONTRACT);
console.log("Party A       :", account.address);
console.log("Starting count:", await currentCount());
console.log("");

const results = [];

for (const ex of examples) {
  console.log("=".repeat(72));
  console.log(ex.tag);
  console.log("=".repeat(72));

  // 1) create_agreement
  console.log("  create_agreement...");
  const createHash = await client.writeContract({
    address: CONTRACT,
    functionName: "create_agreement",
    args: [ex.party_b, ex.title, ex.draft, ex.evidence_urls],
    value: 0n,
  });
  console.log("  create tx:", createHash);
  await waitAccepted(createHash, "create");

  // Fresh id is now `count`.
  const newId = await currentCount();
  console.log("  new agreement id:", newId);

  // 2) compile_agreement (payable) — fee is 0 wei but the method is payable.
  console.log("  compile_agreement (real validators + LLM; can take a while)...");
  const compileHash = await client.writeContract({
    address: CONTRACT,
    functionName: "compile_agreement",
    args: [newId],
    value: 0n,
  });
  console.log("  compile tx:", compileHash);
  await waitAccepted(compileHash, "compile");

  // Read decision surface.
  const ag = await client.readContract({
    address: CONTRACT,
    functionName: "get_agreement",
    args: [newId],
  });
  const summary = {
    id: newId,
    status: ag.status,
    clear_to_commit: ag.clear_to_commit,
    risk_score: ag.risk_score,
    risk_bucket: ag.risk_bucket,
    ambiguity_count: ag.ambiguity_count,
    flags: ag.flags,
    hash: ag.compiled_terms_hash,
  };
  console.log("  compile result:", summary);

  // 3) party_a accept_terms — deployer is party_a.
  if (!ag.compiled_terms_hash) {
    console.warn("  no terms hash; skipping accept step");
  } else {
    console.log("  accept_terms as party_a...");
    const acceptHash = await client.writeContract({
      address: CONTRACT,
      functionName: "accept_terms",
      args: [newId, ag.compiled_terms_hash],
      value: 0n,
    });
    console.log("  accept tx:", acceptHash);
    await waitAccepted(acceptHash, "accept");
  }

  results.push({
    tag: ex.tag,
    id: newId,
    party_b: ex.party_b,
    title: ex.title,
    createTx: createHash,
    compileTx: compileHash,
    summary,
  });
  console.log("");
}

const outPath = path.join(repoRoot, "seed.bradbury.json");
fs.writeFileSync(
  outPath,
  JSON.stringify(
    {
      contract: CONTRACT,
      party_a: account.address,
      seededAt: new Date().toISOString(),
      results,
    },
    null,
    2,
  ) + "\n",
);
console.log("Wrote", outPath);
console.log("All done.");
