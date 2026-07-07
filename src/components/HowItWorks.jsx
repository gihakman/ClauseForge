export function HowItWorks() {
  return (
    <section id="how" className="section section--paper">
      <div className="container">
        <div className="eyebrow">How ClauseForge compiles a deal</div>
        <h2 className="section__title">
          Three transitions, one hash.
        </h2>
        <p className="section__lede">
          A deal is a string of English. ClauseForge turns it into an
          on-chain object that both parties can point at without arguing
          about what it says.
        </p>
        <div className="pipe">
          <div className="pipe__step">
            <h3>1. Draft</h3>
            <p>
              Party A submits the raw text plus, optionally, up to four public
              evidence URLs. Nothing is interpreted yet. Status: <b>DRAFT</b>.
            </p>
            <div className="demo">{`"Party B will make a landing
page for Party A. Should look
modern and clean. Delivery
soon. Payment when done."`}</div>
          </div>
          <div className="pipe__arrow">→</div>
          <div className="pipe__step">
            <h3>2. Compile</h3>
            <p>
              Anyone calls <code className="mono">compile_agreement</code>. A
              leader validator runs an LLM against the draft; other
              validators re-run the extraction and vote against a{" "}
              <b>structured decision surface</b> — not against the raw text.
              Status: <b>COMPILED</b>.
            </p>
            <div className="demo">{`leader_fn → JSON schema
validator_fn → same schema
compare: flags, risk bucket,
ambiguity ±2, clear_to_commit`}</div>
          </div>
          <div className="pipe__arrow">→</div>
          <div className="pipe__step">
            <h3>3. Accept</h3>
            <p>
              Each party signs <code className="mono">accept_terms</code> for
              the exact <b>compiled_terms_hash</b>. When both parties agree
              on the same hash and <code className="mono">clear_to_commit</code>{" "}
              is true, the agreement activates. Status: <b>ACTIVE</b>.
            </p>
            <div className="demo">{`sha256(canonical_terms_json)
=> 0x091854cf522d…f9

both parties sign the hash
=> status = ACTIVE`}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
