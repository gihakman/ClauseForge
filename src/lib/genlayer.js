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

// -------------------- contract-flavoured helpers --------------------

export async function readConfig(client) {
  return client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: "config",
    args: [],
  });
}

export async function readCount(client) {
  const n = await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: "count",
    args: [],
  });
  return Number(n);
}

export async function readList(client, offset = 0, limit = 30) {
  const raw = await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: "list_recent",
    args: [offset, limit],
  });
  return Array.isArray(raw) ? raw : [];
}

export async function readAgreement(client, id) {
  return client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: "get_agreement",
    args: [Number(id)],
  });
}
