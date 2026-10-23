// The History room's rules (docs/time-machine.md): a century of daily market data, its crashes, the
// candles and pacing of a crash film, and the portfolio you steer through it. Pure.

import type { Candle } from "../market/candles";

/** One trading day. */
export interface Day {
  /** Unix seconds, midnight UTC. */
  time: number;
  /** Growth of $1 invested on the first day, dividends reinvested. */
  value: number;
  /** That day's return, as a fraction. */
  ret: number;
}

/** The compact file scripts/build-history.mjs writes. */
export interface HistoryFile {
  source: string;
  from: string;
  to: string;
  /** Days since the trading day before (0 for the first). */
  gaps: number[];
  /** Each day's total return, in basis points. */
  bp: number[];
}

const DAY = 86_400;

export function decodeHistory(file: HistoryFile): Day[] {
  let time = Date.parse(`${file.from}T00:00:00Z`) / 1000;
  let value = 1;
  return file.bp.map((bp, i) => {
    time += file.gaps[i] * DAY;
    const ret = bp / 10_000;
    value *= 1 + ret;
    return { time, value, ret };
  });
}

export interface Crash {
  /** Indexes into the days: the last high before the fall, the low, and the day the high was regained (null: not yet). */
  peak: number;
  bottom: number;
  recovery: number | null;
  /** Peak to bottom, as a positive fraction: 0.34 is −34%. */
  drop: number;
}

/**
 * Every fall of at least `threshold` from a high, with its bottom and the day the high came back.
 * Computed from the data, so the red bands can't disagree with the line.
 */
export function findCrashes(days: readonly Day[], threshold = 0.2): Crash[] {
  const crashes: Crash[] = [];
  let peak = 0;
  let i = 1;
  while (i < days.length) {
    if (days[i].value >= days[peak].value) {
      peak = i++;
      continue;
    }
    let bottom = i;
    let j = i;
    while (j < days.length && days[j].value < days[peak].value) {
      if (days[j].value < days[bottom].value) bottom = j;
      j++;
    }
    const drop = 1 - days[bottom].value / days[peak].value;
    if (drop >= threshold) crashes.push({ peak, bottom, recovery: j < days.length ? j : null, drop });
    if (j >= days.length) break;
    peak = j;
    i = j + 1;
  }
  return crashes;
}

/** The day index at or just before this time. */
export function indexAt(days: readonly Day[], time: number): number {
  let lo = 0;
  let hi = days.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (days[mid].time <= time) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export type Period = "day" | "week";

/**
 * Candles from daily closes (the data has no intraday prices, so none is invented): each opens at the
 * close before it and its high and low are the highest and lowest closes in it. A week starts on Monday.
 * `days[from..to]`, with `from` ≥ 1 so the first candle has an open.
 */
export function closeCandles(days: readonly Day[], from: number, to: number, period: Period): Candle[] {
  const candles: Candle[] = [];
  const weekOf = (t: number) => Math.floor((t / DAY + 3) / 7); // 1970-01-05 was a Monday: weeks start on Mondays
  for (let i = Math.max(1, from); i <= to; i++) {
    const close = days[i].value;
    const last = candles[candles.length - 1];
    if (period === "week" && last && weekOf(days[i].time) === weekOf(last.time)) {
      last.high = Math.max(last.high, close);
      last.low = Math.min(last.low, close);
      last.close = close;
      continue;
    }
    const open = days[i - 1].value;
    candles.push({ time: days[i].time, open, high: Math.max(open, close), low: Math.min(open, close), close });
  }
  return candles;
}

/**
 * How a crash is filmed: by day if it's short enough to watch day by day, by week if not. The film
 * starts a little before the peak and ends when the old high is back (or, for a long recovery, a
 * while after the bottom, then skips ahead).
 */
export function filmPlan(days: readonly Day[], crash: Crash): { from: number; to: number; period: Period; skipsRecovery: boolean } {
  const down = crash.bottom - crash.peak;
  const period: Period = down <= 120 ? "day" : "week";
  const lead = period === "day" ? 10 : 40;
  const tail = period === "day" ? 200 : 800;
  const from = Math.max(1, crash.peak - lead);
  const end = crash.recovery ?? days.length - 1;
  const to = Math.min(end, crash.bottom + tail);
  return { from, to, period, skipsRecovery: to < end };
}

/**
 * Screen time for each candle, in milliseconds, adding up to `total`: every candle gets a beat, and
 * the big moves get more (slow motion on the days that matter).
 */
export function pacing(candles: readonly Candle[], total: number): number[] {
  const weights = candles.map((c) => 1 + Math.min(5, Math.abs(c.close / c.open - 1) / 0.02));
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => (total * w) / sum);
}

// The portfolio you steer through a crash

export interface Holding {
  /** Units of the market (its value is units × the day's value). */
  units: number;
  cash: number;
}

export type Choice = "sell" | "hold" | "buy";

export function startHolding(amount: number, reserve: number, value: number): Holding {
  return { units: amount / value, cash: reserve };
}

export function worth(h: Holding, value: number): number {
  return h.units * value + h.cash;
}

/** Sell everything, hold, or put all the cash reserve in, at this day's value. */
export function decide(h: Holding, choice: Choice, value: number): Holding {
  if (choice === "sell") return { units: 0, cash: h.cash + h.units * value };
  if (choice === "buy") return { units: h.units + h.cash / value, cash: 0 };
  return h;
}

export interface Outcome {
  /** What you did, and three plain paths through the same crash, all ending at the same day. */
  you: number;
  held: number;
  soldAtBottom: number;
  boughtAtBottom: number;
}

/** Each path's worth at the end, starting from the same amount and reserve at the film's start. */
export function outcomes(days: readonly Day[], crash: Crash, start: number, end: number, amount: number, reserve: number, you: Holding): Outcome {
  const v0 = days[start].value;
  const vBottom = days[crash.bottom].value;
  const vEnd = days[end].value;
  const base = startHolding(amount, reserve, v0);
  return {
    you: worth(you, vEnd),
    held: worth(base, vEnd),
    soldAtBottom: worth(decide(base, "sell", vBottom), vEnd),
    boughtAtBottom: worth(decide(base, "buy", vBottom), vEnd),
  };
}

/** A title for how you did, against the plain paths. */
export function verdict(o: Outcome, choices: readonly Choice[]): { title: string; emoji: string } {
  if (choices.includes("sell") && o.you < o.held) return { title: "Paper hands", emoji: "🧻" };
  if (choices.includes("buy") && o.you >= o.held) return { title: "Bought the dip", emoji: "🦅" };
  if (choices.every((c) => c === "hold")) return { title: "Diamond hands", emoji: "💎" };
  return o.you >= o.held ? { title: "Steady nerves", emoji: "🧘" } : { title: "Survived, barely", emoji: "😅" };
}
