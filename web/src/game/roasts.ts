// The lines the game says when things happen. Pure: pick() takes the randomness.

export const LIQUIDATED = [
  "The market thanks you for your donation.",
  "Have you considered index funds?",
  "Your margin has left the chat.",
  "That's not a dip. That's a cliff.",
  "Somewhere, a whale is smiling.",
  "Leverage giveth. Leverage taketh away.",
  "Funds are SAFU. Just not yours.",
  "You were the exit liquidity.",
  "At least the fees were reasonable.",
  "Sir, this is a casino.",
];

export const BIG_WIN = [
  "To the moon! 🚀",
  "Lambo shopping time.",
  "Wen yacht?",
  "Buy high, sell higher. Genius.",
  "The chart bowed to you.",
  "Warren Buffett is taking notes.",
];

export const SMALL_WIN = ["Green is your color.", "Stonks. 📈", "Money printer goes brrr.", "Not bad, not bad at all.", "A win's a win."];

export const LOSS = ["Buy high, sell low: a classic.", "It's only paper money. Probably.", "Down bad.", "You'll get 'em next time.", "Ouch."];

export const ROUND_WIN = ["Called it! 🎯", "Fortune teller.", "Nostradamus who?", "The chart obeys you.", "Easy money."];

export const ROUND_LOSS = ["Wrong way!", "The market said no.", "Coin flip lost.", "Bold call. Wrong, but bold.", "Rigged! (It's not.)"];

export const BAILOUT = [
  "Too big to fail. Here's $10,000.",
  "The government has bailed you out. Again.",
  "Fresh money from the printer. Try not to lose it.",
];

/** One of the lines, chosen by a random number in [0, 1). */
export function pick(lines: readonly string[], random: number = Math.random()): string {
  return lines[Math.min(lines.length - 1, Math.floor(random * lines.length))];
}
