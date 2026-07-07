import { useState } from "react";
import { AgreementCard } from "./AgreementCard.jsx";
import { AgreementDetail } from "./AgreementDetail.jsx";
import { SkeletonCard } from "./SkeletonCard.jsx";
import { verdict } from "../lib/format.js";

export function LiveCompilations({ agreements, loading, loadError, reload }) {
  const [openId, setOpenId] = useState(null);
  const [filter, setFilter] = useState("all");

  const filtered = agreements.filter((a) => {
    const v = verdict(a);
    if (filter === "all") return true;
    if (filter === "clear") return v === "clear";
    if (filter === "blocked") return v === "blocked";
    if (filter === "active") return v === "active";
    return true;
  });

  const showSkeleton = loading && agreements.length === 0;
  const showEmpty = !loading && agreements.length === 0 && !loadError;
  const showFilteredEmpty =
    !showSkeleton && !showEmpty && filtered.length === 0 && !loadError;

  const openAg =
    openId != null
      ? agreements.find((a) => Number(a.id) === Number(openId))
      : null;

  return (
    <section id="live" className="section section--paper">
      <div className="container">
        <div className="eyebrow">Compilations on Bradbury</div>
        <h2 className="section__title">Read straight from the contract.</h2>
        <p className="section__lede">
          Every card below is a real agreement compiled on the ClauseForge
          contract by GenLayer validators. Nothing is cached; the frontend
          calls <code className="mono">list_recent</code> and
          <code className="mono"> get_agreement</code> on load.
        </p>

        <div className="filter">
          <FilterChip
            value="all"
            filter={filter}
            setFilter={setFilter}
            count={agreements.length}
            loading={showSkeleton}
          >
            All
          </FilterChip>
          <FilterChip
            value="clear"
            filter={filter}
            setFilter={setFilter}
            count={agreements.filter((a) => verdict(a) === "clear").length}
            loading={showSkeleton}
          >
            Clear
          </FilterChip>
          <FilterChip
            value="blocked"
            filter={filter}
            setFilter={setFilter}
            count={agreements.filter((a) => verdict(a) === "blocked").length}
            loading={showSkeleton}
          >
            Blocked
          </FilterChip>
          <FilterChip
            value="active"
            filter={filter}
            setFilter={setFilter}
            count={agreements.filter((a) => verdict(a) === "active").length}
            loading={showSkeleton}
          >
            Active
          </FilterChip>
          <button
            className="btn btn--paper btn--sm"
            onClick={reload}
            disabled={loading}
            style={{ marginLeft: "auto" }}
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>

        {loadError && (
          <div className="banner banner--warn">
            <span className="banner__spin" />
            <div>
              <strong>Could not reach the contract right now.</strong>
              <div className="mono mono--sm dim">
                {String(loadError).slice(0, 240)}
              </div>
              <div className="mono mono--sm dim">
                The public Bradbury RPC rate-limits{" "}
                <code>gen_call</code>. Retrying automatically.
              </div>
            </div>
          </div>
        )}

        {showSkeleton && (
          <div className="grid" aria-label="Loading compilations">
            {[0, 1, 2, 3].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {showEmpty && (
          <p className="mono dim">No agreements have been compiled yet.</p>
        )}

        {showFilteredEmpty && (
          <p className="mono dim">No agreements match this filter.</p>
        )}

        {!showSkeleton && filtered.length > 0 && (
          <div className="grid">
            {filtered.map((ag) => (
              <AgreementCard key={ag.id} ag={ag} onOpen={setOpenId} />
            ))}
          </div>
        )}
      </div>

      {openAg && (
        <AgreementDetail ag={openAg} onClose={() => setOpenId(null)} />
      )}
    </section>
  );
}

function FilterChip({ children, value, filter, setFilter, count, loading }) {
  return (
    <button
      className="filter__chip"
      aria-pressed={filter === value}
      onClick={() => setFilter(value)}
      disabled={loading}
    >
      {children}{" "}
      <span className="dim">
        ({loading ? <span className="filter__loading">…</span> : count})
      </span>
    </button>
  );
}
