# ClauseForge

> **Shared meaning, before commitment.** A pre-dispute agreement compiler on GenLayer.

ClauseForge takes a natural-language deal between two parties and turns it into a
**canonical term sheet plus a blocking-ambiguity report**, adjudicated by GenLayer
validators. Both parties then accept the same on-chain hash before anything else
can happen. It is deliberately upstream of the crowded escrow/bounty/court space:
the point is not to decide who won, but to make sure both sides are actually
committing to the same deal.

## Live on Bradbury

| | |
|---|---|
| Network | GenLayer Bradbury testnet (chain id `4221`) |
| RPC | `https://rpc-bradbury.genlayer.com` |
| Contract | [`0x61858bAF59127aaAcf9721585922755Bf40AC2b5`](https://explorer-bradbury.genlayer.com/address/0x61858bAF59127aaAcf9721585922755Bf40AC2b5) |
| Deploy tx | [`0x160ff91f…f05a88e2c54c`](https://explorer-bradbury.genlayer.com/tx/0x160ff91f197885444cc3b79224e50dd70cba6f6453c95fe7e41fd05a88e2c54c) |
| Runner | `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6` |

## What it does

Two parties, `party_a` and `party_b`, submit a raw text draft of a deal. Anyone
then triggers `compile_agreement`, and GenLayer validators:

1. Optionally fetch public evidence URLs referenced in the draft.
2. Run an LLM to extract a structured term sheet.
3. Reach consensus on a small, stable **decision surface** — not on the raw
   prose.

The contract stores:

- **Canonical term sheet** (JSON, deterministically serialised and hashed).
- **Ambiguity report** (a list of concrete missing terms).
- **Decision surface**: five clause-presence booleans, a bucketed risk score, an
  ambiguity count, and a `clear_to_commit` verdict.

To activate the agreement, both parties call `accept_terms` with the exact
`compiled_terms_hash`. Only when both parties have signed **and**
`clear_to_commit` is `true` does the status flip to `ACTIVE`.

Recompiling invalidates prior acceptance so nobody accidentally signs an
out-of-date reading.

## How consensus works

Two LLM runs will disagree on wording. Two LLM runs on a well-designed prompt
will usually agree on the underlying decision. ClauseForge is built around that
observation.

- **Validators compare, exactly**: `clear_to_commit`, the five clause flags, the
  keys extracted for the canonical term sheet (via hash of the canonicalised
  JSON).
- **Validators tolerate**: `ambiguity_count` within ±2, `risk_score` within the
  same low / medium / high bucket.
- **Validators ignore**: the free-form notes and prose in the ambiguity report.
  Those are stored for humans, never gated for consensus.

Implementation lives in [`contracts/clauseforge.py`](./contracts/clauseforge.py).
The relevant snippet:

```python
def _validator_agrees(leader, mine):
    if leader["clear_to_commit"] != mine["clear_to_commit"]:
        return False
    if leader["flags"] != mine["flags"]:
        return False
    if _bucket(leader["risk_score"]) != _bucket(mine["risk_score"]):
        return False
    if abs(leader["ambiguity_count"] - mine["ambiguity_count"]) > 2:
        return False
    return True

result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
```

Parsing of the LLM output is fail-closed: any missing or malformed field
defaults to *clause absent, higher risk, not clear to commit*. Draft text,
evidence URLs, and evidence bodies are all length-bounded so validators can not
be forced into unbounded work.

## Tech

- **Contract**: Python 3.12, GenLayer SDK, pinned GenVM runner.
- **Frontend**: React 18 + Vite 5 + [`genlayer-js`](https://www.npmjs.com/package/genlayer-js) 1.2.
- **Wallet**: any EIP-1193 browser wallet (MetaMask etc.). The site adds
  Bradbury to the wallet automatically via `wallet_addEthereumChain`.
- **Tests**: [`genlayer-test`](https://pypi.org/project/genlayer-test/) direct
  mode; [`genvm-linter`](https://pypi.org/project/genvm-linter/) for AST + SDK
  validation.
- **Hosting**: Vercel static build from the repo root.

## Repository layout

```
contracts/
  clauseforge.py               # the intelligent contract
tests/
  direct/test_clauseforge.py   # 14 direct-mode tests
scripts/
  deploy.mjs                   # deploy the contract to Bradbury
  verify.mjs                   # view-method liveness check
  seed.mjs                     # create + compile + accept 4 real agreements
  retry-compile.mjs            # helper for stubborn compile txs
  accept.mjs                   # standalone accept helper
  get-receipt.mjs              # inspect an existing tx
src/                           # the React frontend
  App.jsx
  main.jsx
  styles.css
  lib/
    genlayer.js                # client factories, wallet plumbing
    format.js                  # display helpers
  components/                  # Header, Hero, HowItWorks, LiveCompilations,
                               # Console (4 tabs), Consensus, Footer, …
public/favicon.svg             # custom mark, reused in the header/footer logo
index.html                     # Vite shell
vite.config.js
vercel.json                    # SPA rewrites + build config
deployment.bradbury.json       # deployment artifact (contract addr, tx hash)
seed.bradbury.json             # seeded example agreements
```

## Running it locally

Prerequisites: Node 18+, Python 3.12+, `uv` (recommended).

Install dependencies:

```bash
npm install
uv venv --python 3.12 .venv
source .venv/bin/activate
uv pip install genvm-linter genlayer-test
```

Lint and test the contract:

```bash
genvm-lint check contracts/clauseforge.py
pytest tests/direct/ -v
```

Serve the frontend against the already-deployed Bradbury contract (no
credentials required for reads):

```bash
npm run dev
```

Reads work with no wallet. To create, compile, or accept agreements from the
UI, install a browser wallet on Bradbury (the site adds it for you) and use the
Interactive Console.

## Deploying your own instance

The deploy script reads `ACCOUNT_PRIVATE_KEY` from `.env`. Never commit `.env`.

```bash
cp .env.example .env      # then fill in ACCOUNT_PRIVATE_KEY with a Bradbury key
node scripts/deploy.mjs   # deploys and writes deployment.bradbury.json
node scripts/verify.mjs   # confirms liveness via config() and count()
node scripts/seed.mjs     # optional: seeds 4 real end-to-end examples
```

Set `VITE_CONTRACT_ADDRESS` at build time to point the frontend at a different
contract; otherwise it uses the one baked into `src/lib/genlayer.js`.

## Design notes  

- **The consensus surface is not the LLM output.** The contract enforces a
  small structured schema and validates on that. Everything else is stored but
  not gated.
- **Recompile invalidates acceptance.** If someone recompiles a deal after a
  party signed, that party's acceptance is cleared. You can only be bound by a
  hash you personally signed.
- **Fees are opt-in.** `fee_wei` defaults to 0 and can be raised by the owner
  via `set_fee`. Fees accumulate on the contract balance and can be routed
  through `set_fee_recipient`.
- **The frontend is docs-first.** Sections earn their place: what the pipeline
  does, live compilations read straight from the chain, an interactive console
  that shows real transaction status, and a technical section explaining the
  equivalence strategy with the actual snippet from the contract.

## License

MIT.
