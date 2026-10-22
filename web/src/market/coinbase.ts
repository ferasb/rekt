// Coinbase's public market data (design.md §6.2): live trades over a WebSocket, candles over HTTPS.
// No key, no account. Both hosts are allowed by the Content Security Policy (vite.config.ts).

import { parseCandles, type Candle, type Granularity } from "./candles";

const WS_URL = "wss://ws-feed.exchange.coinbase.com";
const REST_URL = "https://api.exchange.coinbase.com";

export type FeedStatus = "connecting" | "live" | "offline";

export interface Tick {
  asset: string;
  price: number;
  /** The price 24 hours ago, for the day's change. */
  open24h: number;
  /** Unix ms of the trade. */
  time: number;
}

export interface FeedHandlers {
  onTick(tick: Tick): void;
  onStatus(status: FeedStatus): void;
}

/** If the socket says nothing for this long, it's assumed dead and replaced. */
const SILENCE_MS = 20_000;
const MAX_BACKOFF_MS = 30_000;

/** A Coinbase ticker message as a Tick, or null if it isn't one. */
export function parseTicker(message: unknown): Tick | null {
  if (typeof message !== "object" || message === null) return null;
  const m = message as Record<string, unknown>;
  if (m.type !== "ticker" || typeof m.product_id !== "string") return null;
  const price = Number(m.price);
  const open24h = Number(m.open_24h);
  const time = typeof m.time === "string" ? Date.parse(m.time) : NaN;
  if (!(price > 0)) return null;
  return { asset: m.product_id, price, open24h: open24h > 0 ? open24h : price, time: Number.isFinite(time) ? time : Date.now() };
}

/**
 * Streams every trade on these products until the returned function is called. Reconnects by itself,
 * backing off up to 30 s, and when the socket goes silent.
 */
export function connectFeed(assets: readonly string[], handlers: FeedHandlers): () => void {
  let socket: WebSocket | null = null;
  let stopped = false;
  /** Failed connections in a row, for the backoff. */
  let failures = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let silenceTimer: ReturnType<typeof setTimeout> | undefined;

  const resetSilence = () => {
    clearTimeout(silenceTimer);
    silenceTimer = setTimeout(() => socket?.close(), SILENCE_MS);
  };

  const connect = () => {
    if (stopped) return;
    const ws = new WebSocket(WS_URL);
    socket = ws;
    let live = false;
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "subscribe", product_ids: assets, channels: ["ticker"] }));
      resetSilence();
    };
    ws.onmessage = (e) => {
      resetSilence();
      let message: unknown;
      try {
        message = JSON.parse(String(e.data));
      } catch {
        return;
      }
      const tick = parseTicker(message);
      if (!tick) return;
      // The first price on this connection: now it's live.
      if (!live) {
        live = true;
        failures = 0;
        handlers.onStatus("live");
      }
      handlers.onTick(tick);
    };
    ws.onclose = () => {
      clearTimeout(silenceTimer);
      if (stopped || socket !== ws) return;
      socket = null;
      failures += 1;
      handlers.onStatus("offline");
      const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** (failures - 1)) * (0.75 + Math.random() / 2);
      retryTimer = setTimeout(connect, delay);
    };
    // An error is always followed by close, which reconnects.
    ws.onerror = () => {};
  };

  // Coming back online, or to a tab the browser froze: reconnect now instead of waiting out the backoff.
  const kick = () => {
    if (stopped || socket) return;
    clearTimeout(retryTimer);
    connect();
  };
  window.addEventListener("online", kick);
  document.addEventListener("visibilitychange", kick);

  handlers.onStatus("connecting");
  connect();

  return () => {
    stopped = true;
    clearTimeout(retryTimer);
    clearTimeout(silenceTimer);
    window.removeEventListener("online", kick);
    document.removeEventListener("visibilitychange", kick);
    socket?.close();
  };
}

/**
 * Candles for a product, oldest first: the latest 300, or those between start and end (unix ms;
 * at most 300 candles' worth). Throws when Coinbase can't be reached.
 */
export async function fetchCandles(asset: string, granularity: Granularity, range?: { start: number; end: number }, signal?: AbortSignal): Promise<Candle[]> {
  const params = new URLSearchParams({ granularity: String(granularity) });
  if (range) {
    params.set("start", new Date(range.start).toISOString());
    params.set("end", new Date(range.end).toISOString());
  }
  const response = await fetch(`${REST_URL}/products/${encodeURIComponent(asset)}/candles?${params}`, { signal, referrerPolicy: "no-referrer" });
  if (!response.ok) throw new Error(`Coinbase answered ${response.status}`);
  return parseCandles(await response.json());
}
