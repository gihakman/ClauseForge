import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CHAIN_ID_HEX,
  connectWallet,
  currentWalletAddress,
  makeReadClient,
  onWalletEvents,
  readAll,
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
  const [loadError, setLoadError] = useState(null);
  const inflight = useRef(false);

  const [wallet, setWallet] = useState(null);
  const [chainId, setChainId] = useState(null);

  const wrongChain =
    wallet != null &&
    chainId != null &&
    chainId.toLowerCase() !== CHAIN_ID_HEX.toLowerCase();

  const reload = useCallback(async () => {
    if (inflight.current) return; // never fire concurrent RPC bursts
    inflight.current = true;
    setLoading(true);
    setLoadError(null);
    try {
      const { config: c, count: n, list } = await readAll(readClient);
      setConfig(c);
      setCount(n);
      setAgreements(Array.isArray(list) ? list : []);
    } catch (err) {
      const msg =
        err?.shortMessage || err?.message || err?.details || String(err);
      // Keep any previously-loaded data on screen, but surface the error.
      setLoadError(msg);
      // eslint-disable-next-line no-console
      console.warn("read failed:", msg);
    } finally {
      setLoading(false);
      inflight.current = false;
    }
  }, [readClient]);

  // Initial load + gentle background polling. Pause when the tab is hidden
  // to avoid burning through the gen_call rate limit while nobody is looking.
  useEffect(() => {
    reload();
    let timer = null;
    const start = () => {
      stop();
      timer = setInterval(() => {
        if (document.visibilityState === "visible") reload();
      }, 90_000);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    start();
    const onVis = () => {
      if (document.visibilityState === "visible") reload();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [reload]);

  // Wallet: pick up an already-connected account without prompting.
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
        loadError={loadError}
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
