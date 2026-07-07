import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CHAIN_ID_HEX,
  connectWallet,
  currentWalletAddress,
  makeReadClient,
  onWalletEvents,
  readConfig,
  readCount,
  readList,
} from "./lib/genlayer.js";

import { Header } from "./components/Header.jsx";
import { Hero } from "./components/Hero.jsx";
import { HowItWorks } from "./components/HowItWorks.jsx";
import { LiveCompilations } from "./components/LiveCompilations.jsx";
import { Console } from "./components/Console.jsx";
import { Consensus } from "./components/Consensus.jsx";
import { Footer } from "./components/Footer.jsx";

export default function App() {
  const readClient = useMemo(() => makeReadClient(), []);

  const [config, setConfig] = useState(null);
  const [count, setCount] = useState(null);
  const [agreements, setAgreements] = useState([]);
  const [loading, setLoading] = useState(true);

  const [wallet, setWallet] = useState(null);
  const [chainId, setChainId] = useState(null);

  const wrongChain =
    wallet != null && chainId != null && chainId.toLowerCase() !== CHAIN_ID_HEX.toLowerCase();

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [c, n, list] = await Promise.all([
        readConfig(readClient).catch(() => null),
        readCount(readClient).catch(() => 0),
        readList(readClient, 0, 50).catch(() => []),
      ]);
      setConfig(c);
      setCount(n);
      setAgreements(Array.isArray(list) ? list : []);
    } finally {
      setLoading(false);
    }
  }, [readClient]);

  useEffect(() => {
    reload();
    const t = setInterval(reload, 60_000); // gentle background refresh
    return () => clearInterval(t);
  }, [reload]);

  // Wallet: pick up an already-connected account (no prompt).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const a = await currentWalletAddress();
      if (!cancelled) setWallet(a);
      if (a && window.ethereum) {
        const cid = await window.ethereum.request({ method: "eth_chainId" });
        if (!cancelled) setChainId(cid);
      }
    })();
    const off = onWalletEvents({
      onAccounts: (a) => setWallet(a),
      onChain: (cid) => setChainId(cid),
    });
    return () => {
      cancelled = true;
      off && off();
    };
  }, []);

  const handleConnect = async () => {
    try {
      const a = await connectWallet();
      setWallet(a);
      const cid = await window.ethereum.request({ method: "eth_chainId" });
      setChainId(cid);
    } catch (err) {
      console.error(err);
      alert(err?.message || "Wallet connection failed.");
    }
  };

  const handleDisconnect = () => {
    // MetaMask has no true "disconnect" from a dApp side; we just clear local state.
    setWallet(null);
    setChainId(null);
  };

  return (
    <>
      <Header
        wallet={wallet}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        wrongChain={wrongChain}
      />
      <Hero count={count} config={config} />
      <HowItWorks />
      <LiveCompilations
        agreements={agreements}
        loading={loading}
        reload={reload}
      />
      <Console
        wallet={wallet}
        wrongChain={wrongChain}
        onConnect={handleConnect}
        agreements={agreements}
        reload={reload}
      />
      <Consensus />
      <Footer />
    </>
  );
}
