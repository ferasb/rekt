import { create } from "zustand";
import type { FeedStatus, Tick } from "../market/coinbase";

/**
 * Live prices, for drawing (design.md §6.2). Ticks arrive many times a second; the game reads them
 * as they come (latest, in engine.ts), and this store passes them to React at most ten times a second.
 */
interface PriceState {
  prices: Readonly<Record<string, number>>;
  open24h: Readonly<Record<string, number>>;
  status: FeedStatus;
}

export const usePrices = create<PriceState>(() => ({ prices: {}, open24h: {}, status: "connecting" }));

/** The newest price of every asset, updated on every tick. */
export const latest: Record<string, number> = {};
const latestOpen: Record<string, number> = {};

/** A point a second, per asset, since the page opened: the Up or Down chart. */
export interface Point {
  /** Unix seconds. */
  time: number;
  price: number;
}
const HISTORY_SECONDS = 15 * 60;
const history = new Map<string, Point[]>();

export function recentPoints(asset: string): readonly Point[] {
  return history.get(asset) ?? [];
}

type Listener = (tick: Tick) => void;
const listeners = new Set<Listener>();

/** Calls back on every tick, right away (charts that draw every trade). */
export function onTick(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let flushTimer: ReturnType<typeof setTimeout> | undefined;

function flush(): void {
  flushTimer = undefined;
  usePrices.setState({ prices: { ...latest }, open24h: { ...latestOpen } });
}

export function receiveTick(tick: Tick): void {
  latest[tick.asset] = tick.price;
  latestOpen[tick.asset] = tick.open24h;
  const second = Math.floor(tick.time / 1000);
  let points = history.get(tick.asset);
  if (!points) history.set(tick.asset, (points = []));
  const last = points[points.length - 1];
  if (last && last.time === second) last.price = tick.price;
  else if (!last || second > last.time) points.push({ time: second, price: tick.price });
  if (points.length > HISTORY_SECONDS) points.splice(0, points.length - HISTORY_SECONDS);
  for (const listener of listeners) listener(tick);
  flushTimer ??= setTimeout(flush, 100);
}

export function setFeedStatus(status: FeedStatus): void {
  usePrices.setState({ status });
}
