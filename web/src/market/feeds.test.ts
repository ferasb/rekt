import { describe, expect, it } from "vitest";
import { parseKrakenTicker, parseTicker } from "./feeds";

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

describe("Kraken ticker messages", () => {
  const now = 1_700_000_000_000;

  it("price xStocks at the middle of the bid and ask", () => {
    const message = {
      channel: "ticker",
      type: "update",
      data: [{ symbol: "AAPLx/USD", bid: 348, ask: 348.2, last: 347.5, change: 4.5, change_pct: 1.3 }],
    };
    expect(parseKrakenTicker(message, now)).toEqual([{ asset: "AAPLx/USD", price: 348.1, open24h: 343, time: now }]);
  });

  it("fall back to the last trade without a sane quote", () => {
    const [tick] = parseKrakenTicker({ channel: "ticker", data: [{ symbol: "GMEx/USD", bid: 0, ask: 25, last: 24.5, change: 0 }] }, now)!;
    expect(tick.price).toBe(24.5);
    const [crossed] = parseKrakenTicker({ channel: "ticker", data: [{ symbol: "GMEx/USD", bid: 26, ask: 25, last: 24.5, change: 0 }] }, now)!;
    expect(crossed.price).toBe(24.5);
  });

  it("are ignored when they aren't tickers", () => {
    expect(parseKrakenTicker({ channel: "heartbeat" }, now)).toBeNull();
    expect(parseKrakenTicker({ method: "subscribe", success: true }, now)).toBeNull();
    expect(parseKrakenTicker({ channel: "ticker", data: [{ symbol: "X", bid: "a", ask: "b", last: 0 }] }, now)).toEqual([]);
  });
});
