import { useEffect, useState } from "react";
import { AgreementCard } from "./AgreementCard.jsx";
import { AgreementDetail } from "./AgreementDetail.jsx";
import { verdict } from "../lib/format.js";

export function LiveCompilations({ agreements, loading, reload }) {
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

  const openAg = openId != null ? agreements.find((a) => Number(a.id) === Number(openId)) : null;

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
          <FilterChip value="all" filter={filter} setFilter={setFilter} count={agreements.length}>
            All
          </FilterChip>
          <FilterChip
            value="clear"
            filter={filter}
            setFilter={setFilter}
            count={agreements.filter((a) => verdict(a) === "clear").length}
          >
            Clear
          </FilterChip>
          <FilterChip
            value="blocked"
            filter={filter}
            setFilter={setFilter}
            count={agreements.filter((a) => verdict(a) === "blocked").length}
          >
            Blocked
          </FilterChip>
          <FilterChip
            value="active"
            filter={filter}
            setFilter={setFilter}
            count={agreements.filter((a) => verdict(a) === "active").length}
          >
            Active
          </FilterChip>
          <button
            className="btn btn--paper btn--sm"
            onClick={reload}
            style={{ marginLeft: "auto" }}
          >
            Refresh
          </button>
        </div>

        {loading && filtered.length === 0 && (
          <p className="mono dim">Loading compilations from the contract…</p>
        )}

        {!loading && filtered.length === 0 && (
          <p className="mono dim">No agreements match this filter.</p>
        )}

        <div className="grid">
          {filtered.map((ag) => (
            <AgreementCard key={ag.id} ag={ag} onOpen={setOpenId} />
          ))}
        </div>
      </div>

      {openAg && (
        <AgreementDetail ag={openAg} onClose={() => setOpenId(null)} />
      )}
    </section>
  );
}

function FilterChip({ children, value, filter, setFilter, count }) {
  return (
    <button
      className="filter__chip"
      aria-pressed={filter === value}
      onClick={() => setFilter(value)}
    >
      {children} <span className="dim">({count})</span>
    </button>
  );
}
