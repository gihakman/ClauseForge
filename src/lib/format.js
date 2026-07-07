// Presentation helpers.

export function shortAddr(a, head = 6, tail = 4) {
  if (!a || typeof a !== "string") return "-";
  if (a.length <= head + tail + 2) return a;
  return a.slice(0, head) + "…" + a.slice(-tail);
}

export function shortHash(h, head = 10, tail = 6) {
  if (!h || typeof h !== "string") return "-";
  if (h.length <= head + tail + 2) return h;
  return h.slice(0, head) + "…" + h.slice(-tail);
}

export function riskLabel(bucket) {
  return bucket ? bucket.charAt(0).toUpperCase() + bucket.slice(1) : "-";
}

export function verdict(ag) {
  if (ag.status === "ACTIVE") return "active";
  if (ag.status === "CANCELLED") return "cancelled";
  if (ag.status !== "COMPILED") return "pending";
  return ag.clear_to_commit ? "clear" : "blocked";
}

export function verdictLabel(v) {
  switch (v) {
    case "clear": return "Clear to commit";
    case "blocked": return "Blocked by ambiguity";
    case "active": return "Active";
    case "cancelled": return "Cancelled";
    default: return "Not yet compiled";
  }
}

export function flagsList(ag) {
  const f = ag.flags || {};
  return [
    { key: "del", label: "Deliv", on: !!f.deliverables_present },
    { key: "ddl", label: "Deadl", on: !!f.deadlines_present },
    { key: "pay", label: "Pay", on: !!f.payment_present },
    { key: "acc", label: "Accpt", on: !!f.acceptance_criteria_present },
    { key: "rev", label: "Rev", on: !!f.revision_policy_present },
  ];
}

export function prettyJson(text) {
  if (!text) return "";
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

export function fmtGen(weiStr) {
  try {
    const wei = BigInt(weiStr || "0");
    if (wei === 0n) return "0 GEN";
    const whole = wei / 10n ** 18n;
    const frac = wei % 10n ** 18n;
    if (frac === 0n) return `${whole} GEN`;
    const s = frac.toString().padStart(18, "0").replace(/0+$/, "");
    return `${whole}.${s} GEN`;
  } catch {
    return "0 GEN";
  }
}
