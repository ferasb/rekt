import { describe, expect, it } from "vitest";
import {
  FEE_RATE,
  closePayout,
  isLiquidated,
  liquidationPrice,
  maxMargin,
  openCost,
  openPosition,
  orderProblem,
  pnl,
  positionValue,
  realized,
  roe,
  safety,
  type OpenOrder,
} from "./money";

const order = (o: Partial<OpenOrder> = {}): OpenOrder => ({ asset: "BTC-USD", side: "long", margin: 1000, leverage: 10, price: 50_000, ...o });

describe("opening", () => {
  it("sizes the position by margin × leverage", () => {
    const p = openPosition(order(), "a", 0);
    expect(p.size).toBeCloseTo(0.2); // $10,000 notional at $50,000
    expect(p.openFee).toBeCloseTo(10_000 * FEE_RATE);
  });

  it("costs the margin plus the fee on notional", () => {
    expect(openCost(1000, 10)).toBeCloseTo(1005);
    expect(openCost(1000, 100)).toBeCloseTo(1050); // 100× costs 5% of the margin to get in
  });

  it("finds the largest margin cash can pay for", () => {
    const m = maxMargin(10_000, 100);
    expect(openCost(m, 100)).toBeCloseTo(10_000);
    expect(orderProblem(order({ margin: m, leverage: 100 }), 10_000)).toBeNull();
  });

  it("refuses bad orders", () => {
    expect(orderProblem(order({ margin: 0.5 }), 10_000)).toMatch(/at least/i);
    expect(orderProblem(order({ margin: 10_000 }), 10_000)).toMatch(/cash/i);
    expect(orderProblem(order({ leverage: 101 }), 10_000)).toMatch(/leverage/i);
    expect(orderProblem(order({ leverage: 0.5 }), 10_000)).toMatch(/leverage/i);
    expect(orderProblem(order({ price: 0 }), 10_000)).toMatch(/price/i);
    expect(orderProblem(order({ margin: NaN }), 10_000)).not.toBeNull();
    expect(orderProblem(order(), 10_000)).toBeNull();
  });
});

describe("profit and loss", () => {
  const long = openPosition(order(), "l", 0);
  const short = openPosition(order({ side: "short" }), "s", 0);

  it("longs win when the price rises, shorts when it falls", () => {
    expect(pnl(long, 55_000)).toBeCloseTo(1000); // +10% × 10× = +100% of margin
    expect(pnl(short, 55_000)).toBeCloseTo(-1000);
    expect(pnl(short, 45_000)).toBeCloseTo(1000);
    expect(roe(long, 55_000)).toBeCloseTo(1);
  });

  it("is zero at the entry price", () => {
    expect(pnl(long, 50_000)).toBe(0);
    expect(positionValue(long, 50_000)).toBe(1000);
    expect(positionValue(long, undefined)).toBe(1000);
  });
});

describe("liquidation", () => {
  it("is 1/leverage away, less the maintenance margin", () => {
    expect(liquidationPrice({ side: "long", leverage: 10, entryPrice: 100 })).toBeCloseTo(90.5);
    expect(liquidationPrice({ side: "short", leverage: 10, entryPrice: 100 })).toBeCloseTo(109.5);
    expect(liquidationPrice({ side: "long", leverage: 100, entryPrice: 100 })).toBeCloseTo(99.5);
  });

  it("leaves equity at the maintenance margin at the liquidation price", () => {
    for (const side of ["long", "short"] as const) {
      for (const leverage of [1, 2, 5, 20, 100]) {
        const p = openPosition(order({ side, leverage }), "x", 0);
        const liq = liquidationPrice(p);
        expect(p.margin + pnl(p, liq)).toBeCloseTo(0.005 * p.margin * leverage);
        expect(isLiquidated(p, liq)).toBe(true);
        expect(isLiquidated(p, p.entryPrice)).toBe(false);
      }
    }
  });

  it("never liquidates a 1× long above zero by much", () => {
    const p = openPosition(order({ leverage: 1 }), "x", 0);
    expect(liquidationPrice(p)).toBeCloseTo(250); // 0.5% of $50,000
  });

  it("measures the safety margin from entry to liquidation", () => {
    const p = openPosition(order({ price: 100 }), "x", 0);
    expect(safety(p, 100)).toBe(1);
    expect(safety(p, 120)).toBe(1);
    expect(safety(p, liquidationPrice(p))).toBe(0);
    expect(safety(p, 50)).toBe(0);
    expect(safety(p, (100 + liquidationPrice(p)) / 2)).toBeCloseTo(0.5);
    const s = openPosition(order({ side: "short", price: 100 }), "s", 0);
    expect(safety(s, 80)).toBe(1);
    expect(safety(s, (100 + liquidationPrice(s)) / 2)).toBeCloseTo(0.5);
  });
});

describe("closing", () => {
  it("pays back margin + PnL − the closing fee", () => {
    const p = openPosition(order(), "x", 0);
    const payout = closePayout(p, 55_000);
    expect(payout).toBeCloseTo(1000 + 1000 - 0.2 * 55_000 * FEE_RATE);
    expect(realized(p, payout)).toBeCloseTo(1000 - 5 - 5.5);
  });

  it("loses both fees on a flat trade", () => {
    const p = openPosition(order(), "x", 0);
    expect(realized(p, closePayout(p, 50_000))).toBeCloseTo(-10);
  });

  it("always pays something back before liquidation", () => {
    for (const leverage of [1, 10, 100]) {
      const p = openPosition(order({ leverage }), "x", 0);
      expect(closePayout(p, liquidationPrice(p) * 1.0000001)).toBeGreaterThan(0);
    }
  });
});
