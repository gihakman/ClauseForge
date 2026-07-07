import {
  shortAddr,
  shortHash,
  verdict,
  verdictLabel,
  flagsList,
  riskLabel,
} from "../lib/format.js";

export function AgreementCard({ ag, onOpen }) {
  const v = verdict(ag);
  const risk = ag.risk_bucket || "low";
  const flags = flagsList(ag);
  const status = (ag.status || "DRAFT").toLowerCase();

  return (
    <article className="card" onClick={() => onOpen(Number(ag.id))}>
      <header className="card__head">
        <span className="card__id">#{ag.id.toString().padStart(3, "0")}</span>
        <span className={`card__status card__status--${status}`}>
          {ag.status}
        </span>
      </header>
      <h3 className="card__title">{ag.title || "Untitled"}</h3>

      <div className={`card__verdict card__verdict--${v}`}>
        <span className="card__verdict-dot" />
        <span>{verdictLabel(v)}</span>
      </div>

      <div className="card__flags" aria-label="Extracted clauses">
        {flags.map((f) => (
          <div key={f.key} className={`flag ${f.on ? "flag--on" : ""}`} title={f.label}>
            {f.label}
          </div>
        ))}
      </div>

      <div className="card__meta">
        <div>
          Risk
          <br />
          <strong className={`risk--${risk}`}>
            {riskLabel(risk)} · {Number(ag.risk_score)}
          </strong>
        </div>
        <div>
          Ambiguity
          <br />
          <strong>{Number(ag.ambiguity_count)} flagged</strong>
        </div>
        <div>
          Party A accepted
          <br />
          <strong>{ag.accepted_a ? "yes" : "-"}</strong>
        </div>
        <div>
          Party B accepted
          <br />
          <strong>{ag.accepted_b ? "yes" : "-"}</strong>
        </div>
      </div>

      <footer className="card__parties">
        <div>
          A <span>{shortAddr(ag.party_a)}</span>
        </div>
        <div>
          B <span>{shortAddr(ag.party_b)}</span>
        </div>
        {ag.compiled_terms_hash && (
          <div>
            hash <span>{shortHash(ag.compiled_terms_hash, 12, 8)}</span>
          </div>
        )}
      </footer>
    </article>
  );
}
