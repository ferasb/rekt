// While you were away (design.md §5): which positions candles show were liquidated. Pure.

import type { Candle } from "../market/candles";
import { liquidationPrice, type Position } from "./money";

/**
 * The first moment (unix ms) these candles show the position crossing its liquidation price, or null.
 * Only candles that start at or after `from` (unix ms) count: an earlier candle can hold prices from
 * before the gap, or before the position opened.
 */
export function findLiquidation(position: Position, candles: readonly Candle[], from: number): number | null {
  const start = Math.max(from, position.openedAt);
  const liq = liquidationPrice(position);
  for (const c of candles) {
    if (c.time * 1000 < start) continue;
    if (position.side === "long" ? c.low <= liq : c.high >= liq) return c.time * 1000;
  }
  return null;
}
