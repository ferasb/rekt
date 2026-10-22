// Candles: Coinbase's rows, and extending them with live trades. Pure.

export interface Candle {
  /** Unix seconds: the start of the candle. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

/** Candle sizes Coinbase serves, in seconds. */
export const GRANULARITIES = [60, 300, 900, 3600, 21600, 86400] as const;
export type Granularity = (typeof GRANULARITIES)[number];

/** The most candles Coinbase returns per request. */
export const MAX_CANDLES = 300;

/**
 * Coinbase's rows, [time, low, high, open, close, volume] newest first, as candles oldest first.
 * Rows that aren't six finite numbers are dropped.
 */
export function parseCandles(rows: unknown): Candle[] {
  if (!Array.isArray(rows)) return [];
  const candles: Candle[] = [];
  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 5 || !row.slice(0, 5).every((n) => typeof n === "number" && Number.isFinite(n))) continue;
    const [time, low, high, open, close] = row as number[];
    candles.push({ time, open, high, low, close });
  }
  return candles.sort((a, b) => a.time - b.time);
}

/**
 * Adds a trade to candles (oldest first): updates the last candle, or starts a new one when the trade
 * is in a later period. Returns the candle that changed, for the chart's update(). A trade older than
 * the last candle is ignored (null).
 */
export function applyTrade(candles: Candle[], price: number, timeSec: number, granularity: number): Candle | null {
  const start = Math.floor(timeSec / granularity) * granularity;
  const last = candles[candles.length - 1];
  if (last && start < last.time) return null;
  if (last && start === last.time) {
    const updated = { ...last, high: Math.max(last.high, price), low: Math.min(last.low, price), close: price };
    candles[candles.length - 1] = updated;
    return updated;
  }
  const fresh = { time: start, open: last?.close ?? price, high: Math.max(price, last?.close ?? price), low: Math.min(price, last?.close ?? price), close: price };
  candles.push(fresh);
  return fresh;
}

/** The smallest candle size that covers this many milliseconds in one request. */
export function granularityFor(spanMs: number): Granularity {
  for (const g of GRANULARITIES) {
    if (spanMs / 1000 / g <= MAX_CANDLES) return g;
  }
  return 86400;
}
