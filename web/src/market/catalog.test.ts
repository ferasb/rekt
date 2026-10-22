import { describe, expect, it } from "vitest";
import { assetById, assetFromId, isAssetId, sourceOf } from "./assets";
import { parseCoinbaseCatalog, parseKrakenCatalog } from "./catalog";

describe("asset ids", () => {
  it("tell Coinbase coins from Kraken stocks", () => {
    expect(isAssetId("BTC-USD")).toBe(true);
    expect(isAssetId("1INCH-USD")).toBe(true);
    expect(isAssetId("AAPLx/USD")).toBe(true);
    expect(isAssetId("BRK.Bx/USD")).toBe(true);
    expect(isAssetId("BTC-EUR")).toBe(false);
    expect(isAssetId("AAPL/USD")).toBe(false);
    expect(isAssetId("<script>")).toBe(false);
    expect(isAssetId(5)).toBe(false);
    expect(sourceOf("AAPLx/USD")).toBe("kraken");
    expect(sourceOf("BTC-USD")).toBe("coinbase");
  });

  it("stand in for an asset no list has named", () => {
    expect(assetFromId("AAPLx/USD")).toMatchObject({ symbol: "AAPL", kind: "stock", source: "kraken" });
    expect(assetFromId("ZZZ-USD")).toMatchObject({ symbol: "ZZZ", name: "ZZZ", kind: "crypto" });
    expect(assetById("BTC-USD").name).toBe("Bitcoin");
  });
});

describe("the exchanges' lists", () => {
  it("keep Coinbase's tradeable USD products, named by currency", () => {
    const products = [
      { id: "BTC-USD", base_currency: "BTC", quote_currency: "USD", status: "online", trading_disabled: false },
      { id: "BTC-EUR", base_currency: "BTC", quote_currency: "EUR", status: "online" },
      { id: "OLD-USD", base_currency: "OLD", quote_currency: "USD", status: "delisted" },
      { id: "OFF-USD", base_currency: "OFF", quote_currency: "USD", status: "online", trading_disabled: true },
      { id: "NEW-USD", base_currency: "NEW", quote_currency: "USD", status: "online" },
    ];
    const currencies = [{ id: "BTC", name: "Bitcoin" }];
    expect(parseCoinbaseCatalog(products, currencies).map((a) => [a.id, a.name])).toEqual([
      ["BTC-USD", "Bitcoin"],
      ["NEW-USD", "NEW"],
    ]);
    expect(parseCoinbaseCatalog({ message: "error" }, null)).toEqual([]);
  });

  it("keep Kraken's online xStocks, once each", () => {
    const response = {
      error: [],
      result: {
        AAPLSPVUSD: { wsname: "AAPLx/USD", status: "online" },
        AAPLxUSD: { wsname: "AAPLx/USD", status: "online" },
        KOxUSD: { wsname: "KOx/USD", status: "online" },
        QQQQxUSD: { wsname: "QQQQx/USD", status: "online" },
        ZZZxUSD: { wsname: "ZZZx/USD", status: "cancel_only" },
      },
    };
    expect(parseKrakenCatalog(response).map((a) => [a.id, a.name])).toEqual([
      ["AAPLx/USD", "Apple"],
      ["KOx/USD", "Coca-Cola"],
      ["QQQQx/USD", "QQQQ"],
    ]);
    expect(parseKrakenCatalog({ error: ["EGeneral"] })).toEqual([]);
  });
});
