import { useState } from "react";
import {
  CONTRACT_ADDRESS,
  makeWriteClient,
  connectWallet,
  hasInjectedWallet,
} from "../lib/genlayer.js";
import { TxStatus } from "./TxStatus.jsx";
import { shortAddr } from "../lib/format.js";

// Curated example drafts. Reviewers click one to populate the whole Create
// form in a single move; the wallet still signs every transaction.
// Two are deliberately clear, one is deliberately blocked — together they
// exercise both branches of the compiler.
const PRESETS = [
  {
    id: "audit",
    label: "Solidity audit",
    party_b: "0x2Bd806c97F0e00aF1a1FC3328fA763A9269723C8",
    title: "Solidity audit of MerkleProof helper",
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
    urls: "",
    hint: "clear · low risk",
  },
  {
    id: "vague",
    label: "Vague landing page",
    party_b: "0x81b637d8fcd2c6da6359e6963113a1170de795e4",
    title: "Make me a landing page",
    draft:
      "Party B will make a landing page for Party A. Should look modern " +
      "and clean. Delivery soon. Payment when done. Feedback rounds if " +
      "needed. Party A may request changes.",
    urls: "",
    hint: "should be blocked · high risk",
  },
  {
    id: "agent",
    label: "Agent PR review",
    party_b: "0xE72d97bC44c58f79F5B0Ee7Ba0d24a12ed08b7fC",
    title: "PR review by agent",
    draft:
      "Agent A commits Agent B to review pull request #142 on the " +
      "example.com/repo project. Deliverable: written review with " +
      "actionable comments on correctness, tests, and style. Deadline: " +
      "within 24 hours of assignment. Payment: 10 USDC on acceptance. " +
      "Acceptance criteria: review is considered accepted when Agent A " +
      "either merges the PR or closes the review thread. Revision " +
      "policy: none.",
    urls: "",
    hint: "clear · agent-to-agent",
  },
];

export function Console({
  wallet,
  wrongChain,
  onConnect,
  agreements,
  reload,
}) {
  const [tab, setTab] = useState("read");
  return (
    <section id="console" className="section">
      <div className="container">
        <div className="eyebrow">Interactive console</div>
        <h2 className="section__title">
          Read anything. Write when you&apos;re ready.
        </h2>
        <p className="section__lede">
          Reads work without a wallet. To create, compile, or accept an
          agreement, connect a wallet on Bradbury. The console shows live
          transaction status with an explorer link for every write.
        </p>

        <div className="console">
          <div className="console__tabs" role="tablist">
            <button
              className="tab"
              role="tab"
              aria-selected={tab === "read"}
              onClick={() => setTab("read")}
            >
              Read
            </button>
            <button
              className="tab"
              role="tab"
              aria-selected={tab === "create"}
              onClick={() => setTab("create")}
            >
              Create
            </button>
            <button
              className="tab"
              role="tab"
              aria-selected={tab === "compile"}
              onClick={() => setTab("compile")}
            >
              Compile
            </button>
            <button
              className="tab"
              role="tab"
              aria-selected={tab === "accept"}
              onClick={() => setTab("accept")}
            >
              Accept
            </button>
          </div>
          <div className="console__body">
            {tab === "read" && <ReadTab agreements={agreements} />}
            {tab === "create" && (
              <WriteGate wallet={wallet} wrongChain={wrongChain} onConnect={onConnect}>
                <CreateForm wallet={wallet} reload={reload} />
              </WriteGate>
            )}
            {tab === "compile" && (
              <WriteGate wallet={wallet} wrongChain={wrongChain} onConnect={onConnect}>
                <CompileForm wallet={wallet} agreements={agreements} reload={reload} />
              </WriteGate>
            )}
            {tab === "accept" && (
              <WriteGate wallet={wallet} wrongChain={wrongChain} onConnect={onConnect}>
                <AcceptForm wallet={wallet} agreements={agreements} reload={reload} />
              </WriteGate>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function WriteGate({ wallet, wrongChain, onConnect, children }) {
  if (!hasInjectedWallet()) {
    return (
      <div className="prose">
        <h3>Wallet required</h3>
        <p>
          Writing to ClauseForge needs a browser wallet on Bradbury. Install{" "}
          <a
            className="link"
            href="https://metamask.io/"
            target="_blank"
            rel="noreferrer"
          >
            MetaMask
          </a>{" "}
          (or any compatible wallet) and reload.
        </p>
      </div>
    );
  }
  if (!wallet) {
    return (
      <div className="prose">
        <h3>Connect a wallet</h3>
        <p>
          Reads work without a wallet. See any agreement in the Read tab. To
          create, compile or accept an agreement, connect your wallet on
          Bradbury.
        </p>
        <button className="btn btn--primary" onClick={onConnect}>
          <span className="btn__dot" /> Connect wallet
        </button>
      </div>
    );
  }
  if (wrongChain) {
    return (
      <div className="prose">
        <h3>Wrong network</h3>
        <p>
          Your wallet is on a different chain. Switch (or add) Bradbury
          (chain id 4221).
        </p>
        <button className="btn btn--primary" onClick={onConnect}>
          Switch to Bradbury
        </button>
      </div>
    );
  }
  return children;
}

// -------------------- READ TAB --------------------

function ReadTab({ agreements }) {
  const [id, setId] = useState(agreements[0] ? String(agreements[0].id) : "");
  const chosen = agreements.find((a) => String(a.id) === String(id));
  return (
    <div className="form">
      <div className="field">
        <label>Agreement id</label>
        <select
          className="mono"
          value={id}
          onChange={(e) => setId(e.target.value)}
        >
          {agreements.length === 0 && <option>(no agreements yet)</option>}
          {agreements.map((a) => (
            <option key={a.id} value={a.id}>
              #{String(a.id).padStart(3, "0")} · {a.title || "Untitled"} ({a.status})
            </option>
          ))}
        </select>
        <div className="help">
          Data is read straight from{" "}
          <code>get_agreement(id)</code> on the contract.
        </div>
      </div>
      {chosen && (
        <div className="tx" style={{ borderColor: "var(--hairline-dark)" }}>
          <div className="tx__body">
            <div>
              <strong>{chosen.title}</strong>
            </div>
            <div className="tx__hash">
              status: {chosen.status} · clear_to_commit: {String(chosen.clear_to_commit)} ·
              risk: {String(chosen.risk_score)} · ambiguity: {String(chosen.ambiguity_count)}
            </div>
            <div className="tx__hash">
              party_a accepted: {String(chosen.accepted_a)} · party_b accepted:{" "}
              {String(chosen.accepted_b)}
            </div>
            {chosen.compiled_terms_hash && (
              <div className="tx__hash">hash: {chosen.compiled_terms_hash}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------- CREATE TAB --------------------

function CreateForm({ wallet, reload }) {
  const [partyB, setPartyB] = useState("");
  const [title, setTitle] = useState("");
  const [draft, setDraft] = useState("");
  const [urls, setUrls] = useState("");
  const [tx, setTx] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    setTx({ label: "create_agreement", phase: "preparing", state: "pending" });
    try {
      const evidence = urls
        .split(/\s+|,/)
        .map((s) => s.trim())
        .filter(Boolean);
      const client = makeWriteClient(wallet);
      await client.connect("testnetBradbury");
      setTx({ label: "create_agreement", phase: "waiting for signature", state: "pending" });
      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "create_agreement",
        args: [partyB.trim(), title.trim(), draft, evidence],
        value: 0n,
      });
      setTx({ label: "create_agreement", phase: "waiting for consensus", state: "pending", hash });
      await client.waitForTransactionReceipt({
        hash,
        status: "ACCEPTED",
        interval: 5_000,
        retries: 240,
      });
      setTx({ label: "create_agreement", phase: "accepted on chain", state: "ok", hash });
      setPartyB("");
      setTitle("");
      setDraft("");
      setUrls("");
      await reload();
    } catch (err) {
      console.error(err);
      setTx({
        label: "create_agreement",
        phase: "failed",
        state: "error",
        error: err?.shortMessage || err?.message || String(err),
      });
      setMsg("Transaction failed. Check the wallet or your input.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form" onSubmit={submit}>
      <Presets
        disabled={busy}
        onLoad={(p) => {
          setPartyB(p.party_b);
          setTitle(p.title);
          setDraft(p.draft);
          setUrls(p.urls);
        }}
      />
      <div className="field">
        <label>Party B address</label>
        <input
          className="mono"
          value={partyB}
          onChange={(e) => setPartyB(e.target.value)}
          placeholder="0x…"
          required
        />
        <div className="help">
          Your wallet ({shortAddr(wallet)}) becomes party_a.
        </div>
      </div>
      <div className="field">
        <label>Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={160}
          required
        />
      </div>
      <div className="field">
        <label>Draft text (max 12,000 chars)</label>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={12000}
          placeholder="Party A engages Party B to…"
          required
        />
      </div>
      <div className="field">
        <label>Evidence URLs (optional, up to 4, space or comma separated)</label>
        <input
          className="mono"
          value={urls}
          onChange={(e) => setUrls(e.target.value)}
          placeholder="https://example.com/spec https://…"
        />
      </div>
      <div className="form__actions">
        <button className="btn btn--primary" disabled={busy}>
          {busy ? "Submitting…" : "Create agreement"}
        </button>
        {msg && <span className="form__msg form__msg--err">{msg}</span>}
      </div>
      <TxStatus tx={tx} />
    </form>
  );
}

// -------------------- COMPILE TAB --------------------

function CompileForm({ wallet, agreements, reload }) {
  const draftAgreements = agreements.filter(
    (a) => a.status === "DRAFT" || a.status === "COMPILED",
  );
  const [id, setId] = useState(draftAgreements[0] ? String(draftAgreements[0].id) : "");
  const [tx, setTx] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!id) return;
    setBusy(true);
    setTx({ label: "compile_agreement", phase: "preparing", state: "pending" });
    try {
      const client = makeWriteClient(wallet);
      await client.connect("testnetBradbury");
      setTx({ label: "compile_agreement", phase: "waiting for signature", state: "pending" });
      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "compile_agreement",
        args: [Number(id)],
        value: 0n,
      });
      setTx({
        label: "compile_agreement",
        phase: "running LLM on validators (this can take a minute)",
        state: "pending",
        hash,
      });
      await client.waitForTransactionReceipt({
        hash,
        status: "ACCEPTED",
        interval: 5_000,
        retries: 240,
      });
      setTx({ label: "compile_agreement", phase: "compiled", state: "ok", hash });
      await reload();
    } catch (err) {
      console.error(err);
      setTx({
        label: "compile_agreement",
        phase: "failed",
        state: "error",
        error: err?.shortMessage || err?.message || String(err),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form" onSubmit={submit}>
      <div className="field">
        <label>Agreement to compile</label>
        <select
          className="mono"
          value={id}
          onChange={(e) => setId(e.target.value)}
          required
        >
          {draftAgreements.length === 0 && (
            <option value="">(no draft or compiled agreements available)</option>
          )}
          {draftAgreements.map((a) => (
            <option key={a.id} value={a.id}>
              #{String(a.id).padStart(3, "0")} · {a.title} ({a.status})
            </option>
          ))}
        </select>
        <div className="help">
          Recompiling resets both parties&apos; acceptance so they re-sign the new hash.
        </div>
      </div>
      <div className="form__actions">
        <button className="btn btn--primary" disabled={busy || !id}>
          {busy ? "Compiling…" : "Compile agreement"}
        </button>
        <span className="form__msg">
          Fee: 0 GEN (this deployment is fee-less).
        </span>
      </div>
      <TxStatus tx={tx} />
    </form>
  );
}

// -------------------- ACCEPT TAB --------------------

function AcceptForm({ wallet, agreements, reload }) {
  const compiled = agreements.filter(
    (a) => a.status === "COMPILED" && a.compiled_terms_hash,
  );
  const [id, setId] = useState(compiled[0] ? String(compiled[0].id) : "");
  const chosen = compiled.find((a) => String(a.id) === String(id));
  const [tx, setTx] = useState(null);
  const [busy, setBusy] = useState(false);

  const isPartyA =
    chosen && wallet && chosen.party_a?.toLowerCase() === wallet.toLowerCase();
  const isPartyB =
    chosen && wallet && chosen.party_b?.toLowerCase() === wallet.toLowerCase();

  const submit = async (e) => {
    e.preventDefault();
    if (!chosen) return;
    setBusy(true);
    setTx({ label: "accept_terms", phase: "preparing", state: "pending" });
    try {
      const client = makeWriteClient(wallet);
      await client.connect("testnetBradbury");
      setTx({ label: "accept_terms", phase: "waiting for signature", state: "pending" });
      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "accept_terms",
        args: [Number(chosen.id), chosen.compiled_terms_hash],
        value: 0n,
      });
      setTx({ label: "accept_terms", phase: "waiting for consensus", state: "pending", hash });
      await client.waitForTransactionReceipt({
        hash,
        status: "ACCEPTED",
        interval: 5_000,
        retries: 240,
      });
      setTx({ label: "accept_terms", phase: "accepted", state: "ok", hash });
      await reload();
    } catch (err) {
      console.error(err);
      setTx({
        label: "accept_terms",
        phase: "failed",
        state: "error",
        error: err?.shortMessage || err?.message || String(err),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form" onSubmit={submit}>
      <div className="field">
        <label>Compiled agreement</label>
        <select
          className="mono"
          value={id}
          onChange={(e) => setId(e.target.value)}
          required
        >
          {compiled.length === 0 && (
            <option value="">(no compiled agreements yet)</option>
          )}
          {compiled.map((a) => (
            <option key={a.id} value={a.id}>
              #{String(a.id).padStart(3, "0")} · {a.title}
            </option>
          ))}
        </select>
      </div>
      {chosen && (
        <>
          <div className="field">
            <label>Terms hash to sign</label>
            <div className="mono" style={{ wordBreak: "break-all" }}>
              {chosen.compiled_terms_hash}
            </div>
          </div>
          <div className="field">
            <label>Your role</label>
            <div className="mono">
              {isPartyA
                ? `party_a (${shortAddr(wallet)})`
                : isPartyB
                ? `party_b (${shortAddr(wallet)})`
                : `not a party to this agreement. The contract will reject this call.`}
            </div>
            <div className="help">
              Accepted so far. A: {String(chosen.accepted_a)} · B:{" "}
              {String(chosen.accepted_b)}. Activation requires both parties to
              accept the same hash AND clear_to_commit=true.
            </div>
          </div>
        </>
      )}
      <div className="form__actions">
        <button
          className="btn btn--primary"
          disabled={busy || !chosen || (!isPartyA && !isPartyB)}
        >
          {busy ? "Submitting…" : "Accept terms"}
        </button>
      </div>
      <TxStatus tx={tx} />
    </form>
  );
}


// -------------------- PRESETS --------------------

function Presets({ onLoad, disabled }) {
  return (
    <div className="presets">
      <span className="presets__label">Presets</span>
      {PRESETS.map((p) => (
        <button
          type="button"
          key={p.id}
          className="presets__pill"
          onClick={() => onLoad(p)}
          disabled={disabled}
          title={p.hint}
        >
          <span className="presets__pill-title">{p.label}</span>
          <span className="presets__pill-hint">{p.hint}</span>
        </button>
      ))}
    </div>
  );
}
