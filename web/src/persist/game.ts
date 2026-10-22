import { isAssetId, type Source } from "../market/assets";
import type { Call, Game, Round, RoundResult, Stats, Trade } from "../game/game";
import { MAX_LEVERAGE, type Position, type Side } from "../game/money";

// localStorage, so the game survives closing the browser (design.md §7).
export const GAME_KEY = "rekt:game";

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const pos = (v: unknown): v is number => num(v) && v > 0;
const nonNeg = (v: unknown): v is number => num(v) && v >= 0;
const str = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length < 100;
const side = (v: unknown): v is Side => v === "long" || v === "short";
const call = (v: unknown): v is Call => v === "up" || v === "down";
const obj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function position(v: unknown): Position | null {
  if (!obj(v)) return null;
  const { id, asset, side: s, margin, leverage, entryPrice, size, openFee, openedAt } = v;
  if (!str(id) || !isAssetId(asset) || !side(s) || !pos(margin) || !pos(entryPrice) || !pos(size) || !nonNeg(openFee) || !num(openedAt)) return null;
  if (!num(leverage) || leverage < 1 || leverage > MAX_LEVERAGE) return null;
  return { id, asset, side: s, margin, leverage, entryPrice, size, openFee, openedAt };
}

function trade(v: unknown): Trade | null {
  if (!obj(v)) return null;
  const { id, asset, side: s, leverage, margin, entryPrice, exitPrice, openedAt, closedAt, result, how, away } = v;
  if (!str(id) || !isAssetId(asset) || !side(s) || !pos(leverage) || !pos(margin) || !pos(entryPrice) || !nonNeg(exitPrice)) return null;
  if (!num(openedAt) || !num(closedAt) || !num(result) || (how !== "closed" && how !== "liquidated")) return null;
  return { id, asset, side: s, leverage, margin, entryPrice, exitPrice, openedAt, closedAt, result, how, ...(away === true ? { away } : {}) };
}

function round(v: unknown): Round | null {
  if (!obj(v)) return null;
  const { id, asset, call: c, stake, startPrice, startedAt, endsAt } = v;
  if (!str(id) || !isAssetId(asset) || !call(c) || !pos(stake) || !pos(startPrice) || !num(startedAt) || !num(endsAt)) return null;
  return { id, asset, call: c, stake, startPrice, startedAt, endsAt };
}

function roundResult(v: unknown): RoundResult | null {
  if (!obj(v)) return null;
  const { id, asset, call: c, stake, startPrice, endPrice, outcome, payout, endedAt } = v;
  if (!str(id) || !isAssetId(asset) || !call(c) || !pos(stake) || !pos(startPrice) || !nonNeg(payout) || !num(endedAt)) return null;
  if (!(endPrice === null || pos(endPrice))) return null;
  if (outcome !== "win" && outcome !== "loss" && outcome !== "push" && outcome !== "void") return null;
  return { id, asset, call: c, stake, startPrice, endPrice, outcome, payout, endedAt };
}

const STAT_KEYS = [
  "trades",
  "wins",
  "losses",
  "liquidations",
  "bestTrade",
  "worstTrade",
  "allTimeHigh",
  "roundsWon",
  "roundsLost",
  "roundsPushed",
  "streak",
  "bestStreak",
  "bailouts",
] as const satisfies readonly (keyof Stats)[];

function stats(v: unknown): Stats | null {
  if (!obj(v)) return null;
  const out: Partial<Stats> = {};
  for (const k of STAT_KEYS) {
    if (!num(v[k])) return null;
    out[k] = v[k];
  }
  return out as Stats;
}

function list<T>(v: unknown, parse: (x: unknown) => T | null): T[] | null {
  if (!Array.isArray(v)) return null;
  const out: T[] = [];
  for (const x of v) {
    const parsed = parse(x);
    if (!parsed) return null;
    out.push(parsed);
  }
  return out;
}

/** A game from storage, or null if it isn't one this version understands. */
export function parseGame(v: unknown): Game | null {
  if (!obj(v) || v.version !== 1 || !nonNeg(v.cash) || !num(v.startedAt)) return null;
  const positions = list(v.positions, position);
  const history = list(v.history, trade);
  const rounds = list(v.rounds, roundResult);
  const s = stats(v.stats);
  const r = v.round === null ? null : round(v.round);
  if (!positions || !history || !rounds || !s || (v.round !== null && !r)) return null;
  return { version: 1, cash: v.cash, positions, history, round: r, rounds, stats: s, startedAt: v.startedAt };
}

/** The saved game, or null: storage can be empty, blocked or corrupt. */
export function loadGame(): Game | null {
  try {
    const raw = localStorage.getItem(GAME_KEY);
    return raw ? parseGame(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveGame(game: Game): void {
  try {
    localStorage.setItem(GAME_KEY, JSON.stringify(game));
  } catch {
    // Storage full or blocked: the game lasts until the tab closes.
  }
}

// When each exchange's live feed last watched every price (design.md §5), in their own keys: they're
// written every few seconds, and rewriting the whole game that often could undo another tab's trade.
const COVERED_KEYS: Record<Source, string> = { coinbase: "rekt:covered", kraken: "rekt:covered:kraken" };

/** Unix ms up to which this exchange's feed watched every price, or null. */
export function loadCovered(source: Source): number | null {
  try {
    const value = Number(localStorage.getItem(COVERED_KEYS[source]));
    return value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function saveCovered(source: Source, time: number): void {
  try {
    localStorage.setItem(COVERED_KEYS[source], String(time));
  } catch {
    // Storage blocked: a reopened page can't check what happened while it was closed.
  }
}

/** Calls back when another tab saves the game (design.md §7). */
export function onGameSavedElsewhere(callback: (game: Game | null) => void): void {
  window.addEventListener("storage", (e) => {
    if (e.key === GAME_KEY) {
      callback(loadGame());
    }
  });
}
