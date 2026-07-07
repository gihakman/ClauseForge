import { CONTRACT_ADDRESS, EXPLORER } from "../lib/genlayer.js";
import { Logo } from "./Logo.jsx";

const DEPLOY_TX = "0x160ff91f197885444cc3b79224e50dd70cba6f6453c95fe7e41fd05a88e2c54c";

export function Footer() {
  return (
    <footer className="ftr">
      <div className="container ftr__row">
        <div className="ftr__brand">
          <Logo size={22} />
          <span>ClauseForge</span>
        </div>
        <div>
          Contract{" "}
          <a
            href={`${EXPLORER}/address/${CONTRACT_ADDRESS}`}
            target="_blank"
            rel="noreferrer"
          >
            {CONTRACT_ADDRESS}
          </a>
        </div>
        <div>
          Deploy tx{" "}
          <a
            href={`${EXPLORER}/tx/${DEPLOY_TX}`}
            target="_blank"
            rel="noreferrer"
          >
            {DEPLOY_TX.slice(0, 10)}…{DEPLOY_TX.slice(-8)}
          </a>
        </div>
        <div>
          Built on{" "}
          <a
            href="https://docs.genlayer.com"
            target="_blank"
            rel="noreferrer"
          >
            GenLayer
          </a>
        </div>
      </div>
    </footer>
  );
}
