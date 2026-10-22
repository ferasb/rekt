import { describe, expect, it } from "vitest";
import { applyTrade, granularityFor, parseCandles, type Candle } from "./candles";

describe("Coinbase candles", () => {
  it("parses rows newest first into candles oldest first", () => {
    const rows = [
      [120, 9, 12, 10, 11, 5],
      [60, 8, 11, 9, 10, 3],
    ];
    expect(parseCandles(rows)).toEqual([
      { time: 60, low: 8, high: 11, open: 9, close: 10 },
      { time: 120, low: 9, high: 12, open: 10, close: 11 },
    ]);
  });

  it("drops what isn't a candle", () => {
    expect(parseCandles({ message: "rate limited" })).toEqual([]);
    expect(parseCandles([[1, 2, "3", 4, 5, 6], null, [60, 1, 2, 1, 2, 0]])).toHaveLength(1);
  });
});

describe("live trades", () => {
  const start = (): Candle[] => [{ time: 60, open: 10, high: 12, low: 9, close: 11 }];

  it("update the current candle", () => {
    const candles = start();
    expect(applyTrade(candles, 13, 100, 60)).toEqual({ time: 60, open: 10, high: 13, low: 9, close: 13 });
    applyTrade(candles, 8, 119, 60);
    expect(candles[0]).toMatchObject({ low: 8, close: 8, high: 13 });
  });

  it("start a new candle at the next period, opening at the last close", () => {
    const candles = start();
    expect(applyTrade(candles, 12, 125, 60)).toEqual({ time: 120, open: 11, high: 12, low: 11, close: 12 });
    expect(candles).toHaveLength(2);
  });

  it("ignore trades older than the last candle", () => {
    const candles = start();
    expect(applyTrade(candles, 50, 30, 60)).toBeNull();
    expect(candles).toEqual(start());
  });

  it("start the first candle", () => {
    const candles: Candle[] = [];
    applyTrade(candles, 5, 61, 60);
    expect(candles).toEqual([{ time: 60, open: 5, high: 5, low: 5, close: 5 }]);
  });
});

describe("candle size for a gap", () => {
  it("is the smallest that fits in one request", () => {
    expect(granularityFor(60 * 60_000)).toBe(60);
    expect(granularityFor(5 * 3_600_000)).toBe(60);
    expect(granularityFor(5 * 3_600_000 + 1)).toBe(300);
    expect(granularityFor(24 * 3_600_000)).toBe(300);
    expect(granularityFor(3 * 86_400_000)).toBe(900);
    expect(granularityFor(10 * 86_400_000)).toBe(3600);
    expect(granularityFor(60 * 86_400_000)).toBe(21600);
    expect(granularityFor(1000 * 86_400_000)).toBe(86400);
  });
});
