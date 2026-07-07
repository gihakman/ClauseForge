// GenLayer client factories and wallet helpers.
//
// We keep two clients:
//   * readClient  — always available, does not need a wallet
//   * writeClient — created after wallet connect; signs through window.ethereum
//
// The Bradbury contract address is baked in so the hosted site works with
// zero env config.

import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

export const CONTRACT_ADDRESS =
  (import.meta.env && import.meta.env.VITE_CONTRACT_ADDRESS) ||
  "0x61858bAF59127aaAcf9721585922755Bf40AC2b5";

export const CHAIN = testnetBradbury;
export const CHAIN_ID_HEX = "0x" + testnetBradbury.id.toString(16); // 0x107D

export const EXPLORER = "https://explorer-bradbury.genlayer.com";
export const GITHUB_URL = "https://github.com/gihakman/ClauseForge";

export function makeReadClient() {
  return createClient({ chain: testnetBradbury });
}

export function makeWriteClient(address) {
  if (!address) return null;
  return createClient({
    chain: testnetBradbury,
    account: address,
  });
}

// -------------------- wallet plumbing --------------------

export function hasInjectedWallet() {
  return typeof window !== "undefined" && !!window.ethereum;
}

async function requestAccounts() {
  const accs = await window.ethereum.request({ method: "eth_requestAccounts" });
  return accs && accs[0] ? accs[0] : null;
}

async function currentChainId() {
  return await window.ethereum.request({ method: "eth_chainId" });
}

async function switchOrAddChain() {
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CHAIN_ID_HEX }],
    });
    return true;
  } catch (err) {
    // 4902 = chain not added
    if (err && (err.code === 4902 || err.data?.originalError?.code === 4902)) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: CHAIN_ID_HEX,
            chainName: "GenLayer Bradbury",
            nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
            rpcUrls: ["https://rpc-bradbury.genlayer.com"],
            blockExplorerUrls: [EXPLORER],
          },
        ],
      });
      return true;
    }
    throw err;
  }
}

export async function connectWallet() {
  if (!hasInjectedWallet()) {
    throw new Error("No browser wallet detected. Install MetaMask or a compatible wallet.");
  }
  const address = await requestAccounts();
  if (!address) throw new Error("Wallet did not return an account.");
  const cid = await currentChainId();
  const onRightChain = cid?.toLowerCase() === CHAIN_ID_HEX.toLowerCase();
  if (!onRightChain) await switchOrAddChain();
  return address;
}

export function onWalletEvents({ onAccounts, onChain }) {
  if (!hasInjectedWallet()) return () => {};
  const p = window.ethereum;
  const handleAccs = (accs) => onAccounts && onAccounts(accs && accs[0] ? accs[0] : null);
  const handleChain = (cid) => onChain && onChain(cid);
  p.on && p.on("accountsChanged", handleAccs);
  p.on && p.on("chainChanged", handleChain);
  return () => {
    p.removeListener && p.removeListener("accountsChanged", handleAccs);
    p.removeListener && p.removeListener("chainChanged", handleChain);
  };
}

export async function currentWalletAddress() {
  if (!hasInjectedWallet()) return null;
  const accs = await window.ethereum.request({ method: "eth_accounts" });
  return accs && accs[0] ? accs[0] : null;
}

// -------------------- retry / backoff --------------------

function isRateLimit(err) {
  const m = String(err?.shortMessage || err?.message || err?.details || err || "");
  return /rate limit|rate_limit|Too Many|429|-32029|-32005/i.test(m);
}
function isTransient(err) {
  const m = String(err?.shortMessage || err?.message || err?.details || err || "");
  return /Network|fetch|timeout|ECONNRESET|EAI_AGAIN|502|503|504/i.test(m);
}

async function withBackoff(fn, { retries = 6, base = 800, cap = 8000 } = {}) {
  let last;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (!(isRateLimit(e) || isTransient(e))) throw e;
      const delay = Math.min(base * Math.pow(1.9, i), cap) + Math.random() * 250;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw last;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// -------------------- contract-flavoured helpers --------------------

export async function readConfig(client) {
  return withBackoff(() =>
    client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: "config",
      args: [],
    }),
  );
}

export async function readCount(client) {
  const n = await withBackoff(() =>
    client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: "count",
      args: [],
    }),
  );
  return Number(n);
}

export async function readList(client, offset = 0, limit = 30) {
  const raw = await withBackoff(() =>
    client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: "list_recent",
      args: [offset, limit],
    }),
  );
  return Array.isArray(raw) ? raw : [];
}

export async function readAgreement(client, id) {
  return withBackoff(() =>
    client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: "get_agreement",
      args: [Number(id)],
    }),
  );
}

// Fetch config, count, and list sequentially so we stay under the
// gen_call rate limit (~2/s per IP on Bradbury). Small gap between
// calls plus per-call retry-with-backoff on rate-limit / transient
// errors. Returns { config, count, list } and surfaces errors so the
// caller can render an error state instead of a silent empty grid.
export async function readAll(client) {
  const config = await readConfig(client);
  await sleep(550);
  const count = await readCount(client);
  await sleep(550);
  const list = await readList(client, 0, 50);
  return { config, count, list };
}
