import { shortAddr } from "../lib/format.js";

export function WalletButton({ wallet, onConnect, onDisconnect, wrongChain }) {
  if (!wallet) {
    return (
      <button className="btn btn--primary btn--sm" onClick={onConnect}>
        <span className="btn__dot" />
        Connect wallet
      </button>
    );
  }
  if (wrongChain) {
    return (
      <button className="btn btn--ghost btn--sm" onClick={onConnect}>
        Switch to Bradbury
      </button>
    );
  }
  return (
    <button
      className="btn btn--ghost btn--sm"
      onClick={onDisconnect}
      title="Disconnect"
    >
      <span className="btn__dot" style={{ background: "#6E9C64" }} />
      {shortAddr(wallet)}
    </button>
  );
}
