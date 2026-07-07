import { CONTRACT_ADDRESS, EXPLORER } from "../lib/genlayer.js";
import { shortAddr } from "../lib/format.js";

export function Hero({ count, config }) {
  return (
    <section id="top" className="hero container">
      <div className="hero__grid">
        <div>
          <div className="hero__eyebrow">
            Adjudication layer · GenLayer Bradbury testnet
          </div>
          <h1 className="hero__title">
            Shared meaning,
            <br />
            <em>before</em> commitment.
          </h1>
          <p className="hero__lede">
            ClauseForge compiles a natural-language deal into a{" "}
            <strong>canonical term sheet</strong> and a{" "}
            <strong>blocking-ambiguity report</strong>. GenLayer validators
            reach consensus on whether the draft is even interpretable enough
            to commit against. Both parties then accept the same hash on
            chain — or they don&apos;t.
          </p>
          <div className="hero__ctas">
            <a className="btn btn--primary" href="#console">
              Open the console
            </a>
            <a className="btn btn--ghost" href="#live">
              See live compilations
            </a>
          </div>
          <dl className="hero__meta">
            <div>
              <dt>Network</dt>
              <dd>Bradbury (chain id 4221)</dd>
            </div>
            <div>
              <dt>Contract</dt>
              <dd>
                <a
                  href={`${EXPLORER}/address/${CONTRACT_ADDRESS}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {shortAddr(CONTRACT_ADDRESS, 10, 8)}
                </a>
              </dd>
            </div>
            <div>
              <dt>Compilations on chain</dt>
              <dd>{count == null ? "…" : count.toString()}</dd>
            </div>
            <div>
              <dt>Runner</dt>
              <dd className="short">{config?.runner || "py-genlayer"}</dd>
            </div>
          </dl>
        </div>
        <div>
          <Preview />
        </div>
      </div>
    </section>
  );
}

function Preview() {
  return (
    <div className="preview" aria-hidden="true">
      <div className="preview__head">
        <span>compile_agreement(2) → output</span>
        <span>consensus: accepted</span>
      </div>
      <div className="preview__body">
        <pre>{`{
  `}<span className="preview__key">&quot;clear_to_commit&quot;</span>: <span className="preview__bool--f">false</span>,
  <span className="preview__key">&quot;risk_score&quot;</span>: <span className="preview__num">85</span>,
  <span className="preview__key">&quot;risk_bucket&quot;</span>: <span className="preview__str">&quot;high&quot;</span>,
  <span className="preview__key">&quot;ambiguity_count&quot;</span>: <span className="preview__num">5</span>,
  <span className="preview__key">&quot;flags&quot;</span>: {`{
    `}<span className="preview__key">&quot;deliverables_present&quot;</span>: <span className="preview__bool--t">true</span>,
    <span className="preview__key">&quot;deadlines_present&quot;</span>:     <span className="preview__bool--f">false</span>,
    <span className="preview__key">&quot;payment_present&quot;</span>:       <span className="preview__bool--f">false</span>,
    <span className="preview__key">&quot;acceptance_criteria&quot;</span>:   <span className="preview__bool--f">false</span>,
    <span className="preview__key">&quot;revision_policy&quot;</span>:       <span className="preview__bool--f">false</span>
  {`}`},
  <span className="preview__key">&quot;compiled_terms_hash&quot;</span>:
    <span className="preview__str">
      &quot;0x8631…d5d5&quot;
    </span>
{`}`}</pre>
      </div>
    </div>
  );
}
