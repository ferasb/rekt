import { describe, expect, it } from "vitest";
import type { Candle } from "../market/candles";
import { findLiquidation } from "./away";
import { openPosition } from "./money";

// A 10× long from $100 (liquidated at $90.50), opened at t = 0.
const long = openPosition({ asset: "BTC-USD", side: "long", margin: 100, leverage: 10, price: 100 }, "l", 0);
const short = openPosition({ asset: "BTC-USD", side: "short", margin: 100, leverage: 10, price: 100 }, "s", 0);

const candle = (minute: number, low: number, high: number): Candle => ({ time: minute * 60, open: 100, high, low, close: 100 });

describe("liquidation while away", () => {
  it("finds the first candle that crosses the liquidation price", () => {
    const candles = [candle(1, 95, 101), candle(2, 90, 101), candle(3, 80, 101)];
    expect(findLiquidation(long, candles, 0)).toBe(120_000);
  });

  it("looks at highs for shorts", () => {
    const candles = [candle(1, 95, 105), candle(2, 95, 110)];
    expect(findLiquidation(short, candles, 0)).toBe(120_000);
    expect(findLiquidation(long, candles, 0)).toBeNull();
  });

  it("skips candles from before the gap", () => {
    const candles = [candle(1, 50, 101), candle(2, 95, 101)];
    expect(findLiquidation(long, candles, 61_000)).toBeNull();
  });

  it("skips candles from before the position opened", () => {
    const later = { ...long, openedAt: 90_000 };
    expect(findLiquidation(later, [candle(1, 50, 101), candle(2, 95, 101)], 0)).toBeNull();
  });
});
