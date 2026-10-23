import { FEATS, featsOf, type Feat } from "../game/badges";

// The History room's results: the best one per crash, in localStorage, validated on load.

export interface FilmResult {
  /** What you ended with, what holding would have, and the stake both started from (with the cash). */
  you: number;
  held: number;
  start: number;
  title: string;
  emoji: string;
  /** What you did at the decisions. */
  choices: ("sell" | "hold" | "buy")[];
  /** Unix ms. */
  at: number;
  /** What any play of this crash achieved, for the badges (game/badges.ts). */
  feats: Feat[];
}

/** By crash: the peak's date, and whether it was in today's dollars ("2020-02-19" or "2020-02-19:real"). */
export type Results = Record<string, FilmResult>;

const KEY = "rekt:history";

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const str = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length < 80;

export function parseResults(v: unknown): Results {
  if (typeof v !== "object" || v === null) return {};
  const out: Results = {};
  for (const [key, r] of Object.entries(v as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}(:real)?$/.test(key) || typeof r !== "object" || r === null) continue;
    const { you, held, start, title, emoji, choices, at, feats } = r as Record<string, unknown>;
    if (!num(you) || !num(held) || !num(start) || start <= 0 || !str(title) || !str(emoji) || !num(at)) continue;
    if (!Array.isArray(choices) || !choices.every((c) => c === "sell" || c === "hold" || c === "buy")) continue;
    // Results saved before feats existed: what this one achieved.
    const saved = Array.isArray(feats) ? FEATS.filter((f) => feats.includes(f)) : featsOf({ you, held, choices });
    out[key] = { you, held, start, title, emoji, choices, at, feats: saved };
  }
  return out;
}

export function loadResults(): Results {
  try {
    return parseResults(JSON.parse(localStorage.getItem(KEY) ?? "{}"));
  } catch {
    return {};
  }
}

export function saveResults(results: Results): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(results));
  } catch {
    // Storage full or blocked: results last until the tab closes.
  }
}

/**
 * Keeps a result if it's the first for that crash, or better (as a multiple of what you started
 * with); on a tie, the one where you decided more (holding all the way ends level with just watching).
 * Either way the crash keeps every feat any play of it achieved.
 */
export function keepBest(results: Results, key: string, result: FilmResult): Results {
  const old = results[key];
  const feats = FEATS.filter((f) => old?.feats.includes(f) || result.feats.includes(f));
  if (!old) return { ...results, [key]: { ...result, feats } };
  const a = result.you / result.start;
  const b = old.you / old.start;
  const tie = Math.abs(a - b) <= 1e-9 * b;
  const better = tie ? result.choices.length > old.choices.length : a > b;
  if (!better && feats.length === old.feats.length) return results;
  return { ...results, [key]: { ...(better ? result : old), feats } };
}
