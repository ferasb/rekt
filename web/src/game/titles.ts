// The player's rank by equity (design.md §3). Pure.

export interface Title {
  /** The lowest equity, in dollars, with this title. */
  from: number;
  name: string;
  emoji: string;
}

/** Lowest first. */
export const TITLES: readonly Title[] = [
  { from: 0, name: "Totally Rekt", emoji: "💀" },
  { from: 10, name: "Ramen Budget", emoji: "🍜" },
  { from: 1_000, name: "Bag Holder", emoji: "🎒" },
  { from: 5_000, name: "Paper Hands", emoji: "🧻" },
  { from: 9_000, name: "Retail Trader", emoji: "🛒" },
  { from: 12_500, name: "Diamond Hands", emoji: "💎" },
  { from: 25_000, name: "Degen Legend", emoji: "🦍" },
  { from: 50_000, name: "Crypto Bro", emoji: "😎" },
  { from: 100_000, name: "Whale", emoji: "🐋" },
  { from: 1_000_000, name: "Satoshi's Cousin", emoji: "👑" },
];

export function titleFor(equity: number): Title {
  let title = TITLES[0];
  for (const t of TITLES) if (equity >= t.from) title = t;
  return title;
}

/** The leverage nicknames (design.md §2.1), lowest first. */
export const LEVERAGE_STEPS: readonly { leverage: number; nickname: string }[] = [
  { leverage: 1, nickname: "Boomer mode" },
  { leverage: 2, nickname: "Training wheels" },
  { leverage: 3, nickname: "Mild salsa" },
  { leverage: 5, nickname: "Spicy" },
  { leverage: 10, nickname: "Getting brave" },
  { leverage: 20, nickname: "Degen" },
  { leverage: 50, nickname: "Unhinged" },
  { leverage: 100, nickname: "Send it 🚀" },
];
