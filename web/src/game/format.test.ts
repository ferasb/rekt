import { describe, expect, it } from "vitest";
import { ago, countdown, money, price, priceDecimals, signedMoney, signedPercent } from "./format";
import { pick } from "./roasts";
import { TITLES, titleFor } from "./titles";

describe("formatting", () => {
  it("shows money with cents, and never −$0.00", () => {
    expect(money(12_345.678)).toBe("$12,345.68");
    expect(money(-0.001)).toBe("$0.00");
    expect(money(2_500_000)).toBe("$2.5M");
    expect(signedMoney(12.3)).toBe("+$12.30");
    expect(signedMoney(-12.3)).toBe("−$12.30");
    expect(signedMoney(0.001)).toBe("$0.00");
  });

  it("signs percentages", () => {
    expect(signedPercent(0.1234)).toBe("+12.34%");
    expect(signedPercent(-0.5, 1)).toBe("−50.0%");
    expect(signedPercent(0)).toBe("0.00%");
  });

  it("gives tiny prices enough decimals for four significant digits", () => {
    expect(priceDecimals(81_234.5)).toBe(2);
    expect(priceDecimals(0.2117)).toBe(4);
    expect(priceDecimals(0.0438)).toBe(5);
    expect(price(0.00000438)).toBe("0.000004380");
    expect(price(81_234.5)).toBe("81,234.50");
  });

  it("counts down and back", () => {
    expect(countdown(65_000)).toBe("1:05");
    expect(countdown(29_001)).toBe("0:30");
    expect(countdown(-5)).toBe("0:00");
    expect(ago(30_000)).toBe("just now");
    expect(ago(5 * 60_000)).toBe("5 min ago");
    expect(ago(3 * 3_600_000)).toBe("3 h ago");
    expect(ago(72 * 3_600_000)).toBe("3 days ago");
  });
});

describe("titles", () => {
  it("rank by equity", () => {
    expect(titleFor(0).name).toBe("Totally Rekt");
    expect(titleFor(10_000).name).toBe("Retail Trader");
    expect(titleFor(2_000_000).name).toBe("Satoshi's Cousin");
  });

  it("start a new game in the middle", () => {
    expect(TITLES.every((t, i) => i === 0 || t.from > TITLES[i - 1].from)).toBe(true);
  });
});

describe("roasts", () => {
  it("pick any line, including the last", () => {
    expect(pick(["a", "b"], 0)).toBe("a");
    expect(pick(["a", "b"], 0.9999)).toBe("b");
  });
});
