import { useEffect } from "react";
import {
  shortAddr,
  verdict,
  verdictLabel,
  flagsList,
  riskLabel,
  prettyJson,
} from "../lib/format.js";
import { CONTRACT_ADDRESS, EXPLORER } from "../lib/genlayer.js";

export function AgreementDetail({ ag, onClose }) {
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const v = verdict(ag);
  const risk = ag.risk_bucket || "low";
  const flags = flagsList(ag);
  const ambiguityItems = safeJsonArray(ag.ambiguity_report_json);

  return (
    <div className="detail" onClick={onClose}>
      <div className="detail__panel" onClick={(e) => e.stopPropagation()}>
        <button className="detail__close btn" onClick={onClose}>
          ← Close
        </button>
        <div className="detail__id">
          Agreement #{ag.id} · {ag.status} ·{" "}
          <a
            className="link"
            href={`${EXPLORER}/address/${CONTRACT_ADDRESS}`}
            target="_blank"
            rel="noreferrer"
          >
            on explorer
          </a>
        </div>
        <h2 className="detail__title">{ag.title || "Untitled agreement"}</h2>

        <div
          className={`card__verdict card__verdict--${v}`}
          style={{ marginBottom: 16 }}
        >
          <span className="card__verdict-dot" />
          <span>
            {verdictLabel(v)} · risk {riskLabel(risk)} ({Number(ag.risk_score)})
          </span>
        </div>

        <div className="detail__section">
          <h4>Parties</h4>
          <div className="mono">
            <div>
              A: <span className="dim">{ag.party_a}</span>
              {ag.accepted_a && " · accepted"}
            </div>
            <div>
              B: <span className="dim">{ag.party_b}</span>
              {ag.accepted_b && " · accepted"}
            </div>
          </div>
        </div>

        <div className="detail__section">
          <h4>Draft submitted</h4>
          <div className="detail__draft">{ag.draft_text}</div>
        </div>

        {ag.evidence_urls?.length > 0 && (
          <div className="detail__section">
            <h4>Evidence URLs</h4>
            <ul className="detail__list">
              {ag.evidence_urls.map((u, i) => (
                <li key={i}>
                  <a className="link" href={u} target="_blank" rel="noreferrer">
                    {u}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="detail__section">
          <h4>Required clauses (consensus surface)</h4>
          <div className="card__flags">
            {flags.map((f) => (
              <div
                key={f.key}
                className={`flag ${f.on ? "flag--on" : ""}`}
                title={f.label}
              >
                {f.label}
              </div>
            ))}
          </div>
        </div>

        {ambiguityItems.length > 0 && (
          <div className="detail__section">
            <h4>Ambiguity report ({Number(ag.ambiguity_count)})</h4>
            <ul className="detail__list">
              {ambiguityItems.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        )}

        {ag.compiled_terms_json && (
          <div className="detail__section">
            <h4>Canonical term sheet</h4>
            <pre className="detail__json">
              {prettyJson(ag.compiled_terms_json)}
            </pre>
          </div>
        )}

        {ag.compiled_terms_hash && (
          <div className="detail__section">
            <h4>compiled_terms_hash</h4>
            <div className="detail__hash">{ag.compiled_terms_hash}</div>
          </div>
        )}

        {ag.compiler_notes && (
          <div className="detail__section">
            <h4>Compiler notes</h4>
            <p style={{ margin: 0 }}>{ag.compiler_notes}</p>
          </div>
        )}

        <div className="detail__section">
          <h4>Timestamps</h4>
          <div className="mono mono--sm dim">
            <div>created: {ag.created_at || "-"}</div>
            <div>compiled: {ag.compiled_at || "-"}</div>
            <div>activated: {ag.activated_at || "-"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function safeJsonArray(txt) {
  if (!txt) return [];
  try {
    const v = JSON.parse(txt);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
