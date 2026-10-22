import { describe, expect, it } from "vitest";
import { parseTicker } from "./coinbase";

describe("Coinbase ticker messages", () => {
  it("become ticks", () => {
    const message = { type: "ticker", product_id: "BTC-USD", price: "81231.7", open_24h: "84000.1", time: "2026-10-22T22:26:21.499236Z" };
    expect(parseTicker(message)).toEqual({ asset: "BTC-USD", price: 81231.7, open24h: 84000.1, time: Date.parse("2026-10-22T22:26:21.499Z") });
  });

  it("fall back to the price when there's no 24h open", () => {
    expect(parseTicker({ type: "ticker", product_id: "BONK-USD", price: "0.00000304", time: "2026-10-22T22:26:21Z" })?.open24h).toBe(0.00000304);
  });

  it("are ignored when they aren't tickers or have no price", () => {
    expect(parseTicker({ type: "subscriptions", channels: [] })).toBeNull();
    expect(parseTicker({ type: "ticker", product_id: "BTC-USD", price: "abc" })).toBeNull();
    expect(parseTicker({ type: "ticker", product_id: "BTC-USD", price: "0" })).toBeNull();
    expect(parseTicker(null)).toBeNull();
    expect(parseTicker("ticker")).toBeNull();
  });
});
