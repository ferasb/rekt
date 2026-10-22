// Every coin and stock the exchanges list (design.md §6.1), for search. Loaded the first time someone
// searches, and kept in localStorage for a day: Coinbase's lists are ~90 kB.

import { create } from "zustand";
import { FEATURED, isAssetId, learnAssets, type Asset } from "./assets";
import { STOCK_NAMES } from "./stockNames";

const obj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/**
 * Coinbase's /products and /currencies as assets: online USD products that can be traded, named by
 * their currency ("Bitcoin"), or by the symbol when the currency isn't listed.
 */
export function parseCoinbaseCatalog(products: unknown, currencies: unknown): Asset[] {
  const names = new Map<string, string>();
  if (Array.isArray(currencies)) {
    for (const c of currencies) if (obj(c) && typeof c.id === "string" && typeof c.name === "string") names.set(c.id, c.name);
  }
  if (!Array.isArray(products)) return [];
  const out: Asset[] = [];
  for (const p of products) {
    if (!obj(p) || p.quote_currency !== "USD" || p.status !== "online" || p.trading_disabled === true) continue;
    if (typeof p.id !== "string" || typeof p.base_currency !== "string" || !isAssetId(p.id)) continue;
    out.push({ id: p.id, source: "coinbase", kind: "crypto", symbol: p.base_currency, name: names.get(p.base_currency) ?? p.base_currency });
  }
  return out;
}

/**
 * Kraken's tokenized-asset pairs as stocks: online xStocks against USD. Kraken lists some twice
 * (under two internal names), so each symbol comes out once. Kraken has no company names, so they
 * come from stockNames.ts; a ticker missing there stands in for its name.
 */
export function parseKrakenCatalog(response: unknown): Asset[] {
  if (!obj(response) || !obj(response.result)) return [];
  const out = new Map<string, Asset>();
  for (const pair of Object.values(response.result)) {
    if (!obj(pair) || pair.status !== "online" || typeof pair.wsname !== "string" || !isAssetId(pair.wsname)) continue;
    const symbol = pair.wsname.slice(0, -"x/USD".length);
    out.set(pair.wsname, { id: pair.wsname, source: "kraken", kind: "stock", symbol, name: STOCK_NAMES[symbol] ?? symbol });
  }
  return [...out.values()];
}

const KEY = "rekt:catalog";
const MAX_AGE_MS = 24 * 3600_000;

function loadCached(): Asset[] | null {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (!obj(raw) || typeof raw.savedAt !== "number" || Date.now() - raw.savedAt > MAX_AGE_MS || !Array.isArray(raw.assets)) return null;
    return raw.assets
      .filter((a: unknown): a is Asset => obj(a) && isAssetId(a.id) && typeof a.symbol === "string" && typeof a.name === "string")
      .map((a: Asset) => (a.kind === "stock" ? { ...a, name: STOCK_NAMES[a.symbol] ?? a.name } : a));
  } catch {
    return null;
  }
}

function saveCached(assets: Asset[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ savedAt: Date.now(), assets }));
  } catch {
    // Storage full or blocked: it's fetched again next time.
  }
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { credentials: "omit", referrerPolicy: "no-referrer" });
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return response.json();
}

interface CatalogState {
  /** Featured first, then the rest by symbol. */
  assets: readonly Asset[];
  status: "featured" | "loading" | "full" | "failed";
}

export const useCatalog = create<CatalogState>(() => ({ assets: FEATURED, status: "featured" }));

function settle(all: Asset[], status: "full" | "failed"): void {
  learnAssets(all);
  const featured = new Set(FEATURED.map((a) => a.id));
  const rest = all.filter((a) => !featured.has(a.id)).sort((a, b) => a.symbol.localeCompare(b.symbol));
  useCatalog.setState({ assets: [...FEATURED, ...rest], status });
}

/** Loads every listed coin and stock, once. Featured ones work without it. */
export function loadCatalog(): void {
  const { status } = useCatalog.getState();
  if (status === "loading" || status === "full") return;
  const cached = loadCached();
  if (cached) return settle(cached, "full");
  useCatalog.setState({ status: "loading" });
  Promise.allSettled([
    Promise.all([fetchJson("https://api.exchange.coinbase.com/products"), fetchJson("https://api.exchange.coinbase.com/currencies")]),
    fetchJson("https://api.kraken.com/0/public/AssetPairs?aclass_base=tokenized_asset"),
  ]).then(([coinbase, kraken]) => {
    const all = [
      ...(coinbase.status === "fulfilled" ? parseCoinbaseCatalog(...coinbase.value) : []),
      ...(kraken.status === "fulfilled" ? parseKrakenCatalog(kraken.value) : []),
    ];
    // Keep what came either way, but cache only a whole list: a failed half is tried again on the next search.
    const complete = coinbase.status === "fulfilled" && kraken.status === "fulfilled";
    if (complete) saveCached(all);
    settle(all, complete ? "full" : "failed");
  });
}
