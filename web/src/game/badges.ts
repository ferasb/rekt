// The History room's badges, earned from your saved results. Pure.

/**
 * What a play of a crash achieved, for the badges. Kept per crash across plays (a later, better
 * result doesn't erase that you once held all the way).
 */
export type Feat = "diamond" | "dip" | "beat";
export const FEATS: readonly Feat[] = ["diamond", "dip", "beat"];

/** A play's feats: held at every decision; bought more and ended ahead of holding; ended ahead. */
export function featsOf(r: { you: number; held: number; choices: readonly string[] }): Feat[] {
  const feats: Feat[] = [];
  if (r.choices.length > 0 && r.choices.every((c) => c === "hold")) feats.push("diamond");
  if (r.choices.includes("buy") && r.you > r.held) feats.push("dip");
  if (r.you > r.held) feats.push("beat");
  return feats;
}

export interface Badge {
  id: string;
  emoji: string;
  name: string;
  /** How to earn it, shown before it's earned. */
  how: string;
  earned: boolean;
}

/** `results` are the saved results by crash; `famous` lists the famous crashes' keys (in the mode on screen), for "played them all". */
export function badges(results: Readonly<Record<string, { feats: readonly Feat[] }>>, famous: readonly string[]): Badge[] {
  const all = Object.values(results);
  const has = (feat: Feat) => all.some((r) => r.feats.includes(feat));
  const beat = all.filter((r) => r.feats.includes("beat")).length;
  return [
    { id: "first", emoji: "🎬", name: "First film", how: "Live through any crash.", earned: all.length > 0 },
    { id: "diamond", emoji: "💎", name: "Diamond hands", how: "With “Stop to decide” on, hold at every decision.", earned: has("diamond") },
    { id: "dip", emoji: "🦅", name: "Bought the dip", how: "With “Stop to decide” on, buy more, and end ahead of holding.", earned: has("dip") },
    { id: "beat", emoji: "🏆", name: "Beat the market", how: "With “Stop to decide” on, end ahead of holding in three crashes.", earned: beat >= 3 },
    { id: "all", emoji: "📜", name: "Historian", how: "Live through every famous crash.", earned: famous.length > 0 && famous.every((k) => k in results) },
    { id: "great", emoji: "🎩", name: "Survived 1929", how: "Live through the Great Crash.", earned: Object.keys(results).some((k) => k.startsWith("1929-")) },
  ];
}
