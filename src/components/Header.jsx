import { Logo } from "./Logo.jsx";
import { GithubIcon } from "./GithubIcon.jsx";
import { WalletButton } from "./WalletButton.jsx";
import { GITHUB_URL } from "../lib/genlayer.js";

export function Header({ wallet, onConnect, onDisconnect, wrongChain }) {
  return (
    <header className="hdr">
      <div className="container hdr__row">
        <a href="#top" className="hdr__brand" aria-label="ClauseForge">
          <span className="hdr__mark"><Logo size={26} /></span>
          <span className="hdr__word">
            Clause<em>Forge</em>
          </span>
        </a>
        <nav className="hdr__nav">
          <a href="#how">How it works</a>
          <a href="#live">Compilations</a>
          <a href="#console">Console</a>
          <a href="#consensus">Consensus</a>
          <a
            href="https://docs.genlayer.com"
            target="_blank"
            rel="noreferrer"
          >
            Docs
          </a>
        </nav>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          className="hdr__icon"
          aria-label="ClauseForge on GitHub"
          title="Open the ClauseForge repository on GitHub"
        >
          <GithubIcon size={16} />
        </a>
        <div className="hdr__wallet">
          <WalletButton
            wallet={wallet}
            onConnect={onConnect}
            onDisconnect={onDisconnect}
            wrongChain={wrongChain}
          />
        </div>
      </div>
    </header>
  );
}
