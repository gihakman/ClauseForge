export function Consensus() {
  return (
    <section id="consensus" className="section">
      <div className="container">
        <div className="eyebrow">Consensus, closer up</div>
        <h2 className="section__title">
          Validators vote on a decision surface.
        </h2>
        <p className="section__lede">
          The trap with putting an LLM behind a contract is that its raw text
          output differs on every run. ClauseForge sidesteps this by returning
          a small, structured surface, not free-form prose, and comparing
          only what matters.
        </p>

        <div className="split">
          <div className="prose">
            <h3>What validators actually compare</h3>
            <ul>
              <li>
                <strong>clear_to_commit</strong>: exact bool match.
              </li>
              <li>
                <strong>Five clause flags</strong>: deliverables, deadlines,
                payment, acceptance criteria, revision policy. Exact match.
              </li>
              <li>
                <strong>risk_score</strong>: validators must agree on the
                bucket (low 0–33, medium 34–66, high 67–100). Point values
                may differ.
              </li>
              <li>
                <strong>ambiguity_count</strong>: within a tolerance of ±2.
              </li>
            </ul>
            <p>
              Rich text (the canonical term sheet, ambiguity report, notes)
              is stored but <strong>never validator-gated</strong>. That&apos;s the
              part where two LLM runs will disagree word-for-word yet mean the
              same thing.
            </p>
            <p>
              This is a straightforward custom validator with{" "}
              <code className="mono">gl.vm.run_nondet_unsafe</code>, aligned
              with the GenLayer guidance to compare stable decision fields
              instead of raw prose.
            </p>
          </div>
          <pre className="snippet">
{`# excerpt from contracts/clauseforge.py

def _validator_agrees(leader, mine):
    if leader["clear_to_commit"] != mine["clear_to_commit"]:
        return False
    if leader["flags"] != mine["flags"]:
        return False
    if _bucket(leader["risk_score"]) != _bucket(mine["risk_score"]):
        return False
    if abs(leader["ambiguity_count"]
           - mine["ambiguity_count"]) > 2:
        return False
    return True

def leader_fn():
    for url in evidence_urls:
        body = gl.nondet.web.get(url).body[:4000]
        ...
    raw = gl.nondet.exec_prompt(prompt,
                                response_format="json")
    return _parse_compilation(raw)

def validator_fn(res):
    if not isinstance(res, gl.vm.Return):
        return False
    return _validator_agrees(res.calldata, leader_fn())

result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)`}
          </pre>
        </div>
      </div>
    </section>
  );
}
