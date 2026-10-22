import { describe, expect, it } from "vitest";
import { FEATURED, assetFromId, type Asset } from "./assets";
import { searchAssets } from "./search";

const all: Asset[] = [...FEATURED, { ...assetFromId("BTCT-USD"), name: "Bitcoin Token" }, assetFromId("F-USD"), assetFromId("Fx/USD")];
const symbols = (q: string, limit?: number) => searchAssets(all, q, limit).map((a) => `${a.symbol}:${a.kind}`);

describe("search", () => {
  it("puts an exact symbol first, then prefixes", () => {
    expect(symbols("btc")[0]).toBe("BTC:crypto");
    expect(symbols("btc")).toContain("BTCT:crypto");
  });

  it("finds by name, and by a word in the name", () => {
    expect(symbols("apple")[0]).toBe("AAPL:stock");
    expect(symbols("cash")).toContain("BCH:crypto");
    expect(symbols("bitcoin").slice(0, 2)).toEqual(["BTC:crypto", "BCH:crypto"]);
  });

  it("finds a stock and a coin with the same symbol", () => {
    expect(symbols("f")).toEqual(expect.arrayContaining(["F:crypto", "F:stock"]));
  });

  it("ignores case, spaces and a leading $", () => {
    expect(symbols("  $TSLA ")[0]).toBe("TSLA:stock");
  });

  it("matches nothing for an empty query, and respects the limit", () => {
    expect(symbols("   ")).toEqual([]);
    expect(symbols("a", 3)).toHaveLength(3);
  });
});
