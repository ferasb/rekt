// Live prices and candles from the exchanges' public market data (design.md §6.2): Coinbase for
// crypto, Kraken for stocks. No keys, no accounts, no cookies. Every host here is allowed by the
// Content Security Policy (vite.config.ts).

import { sourceOf, type Source } from "./assets";
import { GRANULARITIES, KRAKEN_GRANULARITIES, KRAKEN_MAX_CANDLES, MAX_CANDLES, parseCandles, parseKrakenCandles, type Candle } from "./candles";

/** "idle": nothing to watch on that exchange, so no connection. */
export type FeedStatus = "idle" | "connecting" | "live" | "offline";

export interface Tick {
  asset: string;
  price: number;
  /** The price 24 hours ago, for the day's change. */
  open24h: number;
  /** Unix ms. */
  time: number;
}

export interface FeedHandlers {
  onTick(tick: Tick): void;
  onStatus(status: FeedStatus): void;
}

/** One live connection to an exchange, watching whichever assets it's given. */
export interface Feed {
  /** Watches exactly these assets from now on: subscribes the new ones, drops the rest. */
  watch(assets: readonly string[]): void;
  stop(): void;
}

interface Exchange {
  url: string;
  subscribe(assets: string[]): unknown;
  unsubscribe(assets: string[]): unknown;
  /** The ticks in a message, or null if it carries none (acks, heartbeats). */
  parse(message: unknown): Tick[] | null;
  /** Whether this message shows the connection works, even without a tick (Kraken's heartbeat). */
  alive(message: unknown): boolean;
}

const obj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/** A Coinbase ticker message as a Tick, or null if it isn't one. */
export function parseTicker(message: unknown): Tick | null {
  if (!obj(message) || message.type !== "ticker" || typeof message.product_id !== "string") return null;
  const price = Number(message.price);
  const open24h = Number(message.open_24h);
  const time = typeof message.time === "string" ? Date.parse(message.time) : NaN;
  if (!(price > 0)) return null;
  return { asset: message.product_id, price, open24h: open24h > 0 ? open24h : price, time: Number.isFinite(time) ? time : Date.now() };
}

/**
 * A Kraken v2 ticker message as ticks, or null. The price is the middle of the best bid and ask
 * (the mark price): xStocks trade rarely, but market makers keep their quotes on the share.
 */
export function parseKrakenTicker(message: unknown, now: number): Tick[] | null {
  if (!obj(message) || message.channel !== "ticker" || !Array.isArray(message.data)) return null;
  const ticks: Tick[] = [];
  for (const d of message.data) {
    if (!obj(d) || typeof d.symbol !== "string") continue;
    const bid = Number(d.bid);
    const ask = Number(d.ask);
    const last = Number(d.last);
    const price = bid > 0 && ask > 0 && ask >= bid ? (bid + ask) / 2 : last;
    if (!(price > 0)) continue;
    const open24h = last - Number(d.change);
    ticks.push({ asset: d.symbol, price, open24h: open24h > 0 ? open24h : price, time: now });
  }
  return ticks;
}

const COINBASE: Exchange = {
  url: "wss://ws-feed.exchange.coinbase.com",
  // Coinbase sends each product's latest price right after subscribing, then every trade.
  subscribe: (ids) => ({ type: "subscribe", product_ids: ids, channels: ["ticker"] }),
  unsubscribe: (ids) => ({ type: "unsubscribe", product_ids: ids, channels: ["ticker"] }),
  parse: (m) => {
    const tick = parseTicker(m);
    return tick ? [tick] : null;
  },
  alive: () => false,
};

const KRAKEN: Exchange = {
  url: "wss://ws.kraken.com/v2",
  // A snapshot first, then an update whenever the best bid or ask moves.
  subscribe: (ids) => ({ method: "subscribe", params: { channel: "ticker", symbol: ids, event_trigger: "bbo" } }),
  unsubscribe: (ids) => ({ method: "unsubscribe", params: { channel: "ticker", symbol: ids, event_trigger: "bbo" } }),
  parse: (m) => parseKrakenTicker(m, Date.now()),
  // Kraken sends a heartbeat every second while anything is subscribed.
  alive: (m) => obj(m) && m.channel === "heartbeat",
};

/** If the socket says nothing for this long, it's assumed dead and replaced. */
const SILENCE_MS = 20_000;
const MAX_BACKOFF_MS = 30_000;

/**
 * A WebSocket to one exchange that watches a changing set of assets. It connects only while there's
 * something to watch, reconnects by itself (backing off up to 30 s), and replaces a silent socket.
 */
function connect(exchange: Exchange, handlers: FeedHandlers): Feed {
  let wanted = new Set<string>();
  let socket: WebSocket | null = null;
  let open = false;
  let stopped = false;
  /** Failed connections in a row, for the backoff. */
  let failures = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let silenceTimer: ReturnType<typeof setTimeout> | undefined;

  const send = (message: unknown) => socket?.send(JSON.stringify(message));

  const resetSilence = () => {
    clearTimeout(silenceTimer);
    silenceTimer = setTimeout(() => socket?.close(), SILENCE_MS);
  };

  const start = () => {
    if (stopped || socket || wanted.size === 0) return;
    const ws = new WebSocket(exchange.url);
    socket = ws;
    open = false;
    let live = false;
    ws.onopen = () => {
      open = true;
      send(exchange.subscribe([...wanted]));
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
      const ticks = exchange.parse(message);
      if (!ticks && !exchange.alive(message)) return;
      // The first sign of life on this connection: now it's live.
      if (!live) {
        live = true;
        failures = 0;
        handlers.onStatus("live");
      }
      // Only what's still wanted: an unsubscribe can cross a tick in flight.
      for (const tick of ticks ?? []) if (wanted.has(tick.asset)) handlers.onTick(tick);
    };
    ws.onclose = () => {
      clearTimeout(silenceTimer);
      if (socket !== ws) return;
      socket = null;
      open = false;
      if (stopped) return;
      if (wanted.size === 0) {
        handlers.onStatus("idle");
        return;
      }
      failures += 1;
      handlers.onStatus("offline");
      const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** (failures - 1)) * (0.75 + Math.random() / 2);
      retryTimer = setTimeout(start, delay);
    };
    // An error is always followed by close, which reconnects.
    ws.onerror = () => {};
  };

  // Coming back online, or to a tab the browser froze: reconnect now instead of waiting out the backoff.
  const kick = () => {
    if (stopped || socket) return;
    clearTimeout(retryTimer);
    start();
  };
  window.addEventListener("online", kick);
  document.addEventListener("visibilitychange", kick);

  return {
    watch(assets) {
      const next = new Set(assets);
      const added = [...next].filter((a) => !wanted.has(a));
      const removed = [...wanted].filter((a) => !next.has(a));
      wanted = next;
      if (next.size === 0) {
        clearTimeout(retryTimer);
        if (socket) socket.close();
        else handlers.onStatus("idle");
        return;
      }
      if (!socket) {
        handlers.onStatus("connecting");
        clearTimeout(retryTimer);
        start();
        return;
      }
      if (!open) return; // onopen subscribes to everything wanted.
      if (added.length) send(exchange.subscribe(added));
      if (removed.length) send(exchange.unsubscribe(removed));
    },
    stop() {
      stopped = true;
      clearTimeout(retryTimer);
      clearTimeout(silenceTimer);
      window.removeEventListener("online", kick);
      document.removeEventListener("visibilitychange", kick);
      socket?.close();
    },
  };
}

export function connectFeed(source: Source, handlers: FeedHandlers): Feed {
  return connect(source === "coinbase" ? COINBASE : KRAKEN, handlers);
}

// Candles

async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  // No cookies either way: both exchanges' Cloudflare fronts set some (privacy.html), and this needs none.
  const response = await fetch(url, { signal, credentials: "omit", referrerPolicy: "no-referrer" });
  if (!response.ok) throw new Error(`${new URL(url).host} answered ${response.status}`);
  return response.json();
}

/** Candle sizes each exchange serves, in seconds, and how many come back at most. */
export const CANDLE_LIMITS: Record<Source, { sizes: readonly number[]; max: number }> = {
  coinbase: { sizes: GRANULARITIES, max: MAX_CANDLES },
  kraken: { sizes: KRAKEN_GRANULARITIES, max: KRAKEN_MAX_CANDLES },
};

/**
 * Candles for an asset, oldest first: the latest ones, or (Coinbase) those between start and end, or
 * (Kraken, which only keeps its latest 720) those since start. Unix ms. Throws when the exchange
 * can't be reached.
 */
export async function fetchCandles(asset: string, granularity: number, range?: { start: number; end: number }, signal?: AbortSignal): Promise<Candle[]> {
  if (sourceOf(asset) === "kraken") {
    const params = new URLSearchParams({ pair: asset.replace("/", ""), interval: String(granularity / 60), asset_class: "tokenized_asset" });
    if (range) params.set("since", String(Math.floor(range.start / 1000)));
    const body = await getJson(`https://api.kraken.com/0/public/OHLC?${params}`, signal);
    if (!obj(body) || !obj(body.result) || (Array.isArray(body.error) && body.error.length)) throw new Error("Kraken refused the candles");
    const key = Object.keys(body.result).find((k) => k !== "last");
    const candles = parseKrakenCandles(key ? body.result[key] : []);
    return range ? candles.filter((c) => c.time * 1000 <= range.end) : candles;
  }
  const params = new URLSearchParams({ granularity: String(granularity) });
  if (range) {
    params.set("start", new Date(range.start).toISOString());
    params.set("end", new Date(range.end).toISOString());
  }
  return parseCandles(await getJson(`https://api.exchange.coinbase.com/products/${encodeURIComponent(asset)}/candles?${params}`, signal));
}
