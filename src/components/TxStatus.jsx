import { EXPLORER } from "../lib/genlayer.js";
import { shortHash } from "../lib/format.js";

export function TxStatus({ tx }) {
  if (!tx) return null;
  const cls = tx.state === "error" ? "tx tx--err" : tx.state === "ok" ? "tx tx--ok" : "tx";
  return (
    <div className={cls}>
      <span className="tx__spin" />
      <div className="tx__body">
        <div>
          <strong>{tx.label || "Transaction"}</strong> · {tx.phase}
        </div>
        {tx.hash && (
          <div className="tx__hash">
            {shortHash(tx.hash, 14, 8)}{" "}
            <a
              href={`${EXPLORER}/tx/${tx.hash}`}
              target="_blank"
              rel="noreferrer"
            >
              open in explorer ↗
            </a>
          </div>
        )}
        {tx.state === "error" && tx.error && (
          <div className="tx__hash" style={{ color: "var(--danger)" }}>
            {tx.error}
          </div>
        )}
      </div>
    </div>
  );
}
