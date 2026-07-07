// Retrieve receipt for an existing deploy tx and print the derived contract address.
// Usage: node scripts/get-receipt.mjs <tx_hash>

import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

const hash = process.argv[2];
if (!hash) {
  console.error("Usage: node scripts/get-receipt.mjs <tx_hash>");
  process.exit(1);
}

const client = createClient({ chain: testnetBradbury });
const tx = await client.getTransaction({ hash });
console.log(JSON.stringify({
  hash,
  statusName: tx?.statusName ?? tx?.status,
  txExecutionResultName: tx?.txExecutionResultName,
  contractAddress: tx?.data?.contract_address || tx?.txDataDecoded?.contractAddress || tx?.recipient || null,
  recipient: tx?.recipient,
  createdAt: tx?.timestamps?.Created,
}, null, 2));
