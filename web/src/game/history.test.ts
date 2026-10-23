import { describe, expect, it } from "vitest";
import usMarket from "../market/history/us-market.json";
import { closeCandles, decide, decodeHistory, filmPlan, findCrashes, indexAt, outcomes, pacing, startHolding, verdict, worth, type Day, type HistoryFile } from "./history";

const DAY = 86_400;
/** Days from a list of values, one a day from 2020-01-01. */
const series = (values: number[]): Day[] =>
  values.map((value, i) => ({ time: Date.UTC(2020, 0, 1) / 1000 + i * DAY, value, ret: i ? value / values[i - 1] - 1 : 0 }));

describe("the data file", () => {
  it("decodes into growing values and real dates", () => {
    const file: HistoryFile = { source: "", from: "2020-01-02", to: "", gaps: [0, 1, 3], bp: [0, 1000, -500] };
    const days = decodeHistory(file);
    expect(days.map((d) => new Date(d.time * 1000).toISOString().slice(0, 10))).toEqual(["2020-01-02", "2020-01-03", "2020-01-06"]);
    expect(days[1].value).toBeCloseTo(1.1);
    expect(days[2].value).toBeCloseTo(1.045);
  });

  it("finds the famous crashes in the real data, at their real dates", () => {
    const days = decodeHistory(usMarket as HistoryFile);
    const date = (i: number) => new Date(days[i].time * 1000).toISOString().slice(0, 10);
    const crashes = findCrashes(days);
    const covid = crashes.find((c) => date(c.peak) === "2020-02-19")!;
    expect(date(covid.bottom)).toBe("2020-03-23");
    expect(covid.drop).toBeGreaterThan(0.3);
    expect(covid.bottom - covid.peak).toBeLessThan(30); // trading days: a fast crash
    const crash1929 = crashes.find((c) => date(c.peak) === "1929-09-03")!;
    expect(crash1929.drop).toBeGreaterThan(0.8);
    expect(crashes.find((c) => date(c.peak) === "1987-08-25")).toBeDefined();
  });
});

describe("crashes", () => {
  it("are falls of 20% or more, with their bottom and recovery", () => {
    const days = series([100, 120, 90, 80, 110, 125, 130, 110, 140]);
    expect(findCrashes(days)).toEqual([{ peak: 1, bottom: 3, recovery: 5, drop: 1 - 80 / 120 }]);
  });

  it("leave small dips alone, and can be still unrecovered", () => {
    expect(findCrashes(series([100, 90, 101]))).toEqual([]);
    const [open] = findCrashes(series([100, 70, 75]));
    expect(open).toMatchObject({ peak: 0, bottom: 1, recovery: null });
    expect(open.drop).toBeCloseTo(0.3);
  });

  it("finds the day at or before a time", () => {
    const days = series([1, 2, 3]);
    expect(indexAt(days, days[1].time + 100)).toBe(1);
    expect(indexAt(days, 0)).toBe(0);
  });
});

describe("candles from closes", () => {
  it("open at the close before, and invent nothing between closes", () => {
    const days = series([100, 110, 99]);
    expect(closeCandles(days, 1, 2, "day")).toEqual([
      { time: days[1].time, open: 100, high: 110, low: 100, close: 110 },
      { time: days[2].time, open: 110, high: 110, low: 99, close: 99 },
    ]);
  });

  it("group days into weeks starting on Monday", () => {
    // 2020-01-01 is a Wednesday: Wed–Sun is one week, Mon 2020-01-06 starts the next.
    const days = series([100, 105, 95, 98, 100, 90, 92]);
    const weeks = closeCandles(days, 1, 6, "week");
    expect(weeks).toHaveLength(2);
    expect(weeks[0]).toMatchObject({ open: 100, high: 105, low: 95, close: 100 });
    expect(weeks[1]).toMatchObject({ open: 100, close: 92, low: 90 });
  });
});

describe("the film", () => {
  it("films short crashes by the day and long ones by the week", () => {
    const short = filmPlan(series(Array.from({ length: 300 }, (_, i) => 100 - (i > 20 && i < 40 ? 30 : 0))), { peak: 20, bottom: 30, recovery: 40, drop: 0.3 });
    expect(short).toMatchObject({ period: "day", from: 10, to: 40, skipsRecovery: false });
    const long = filmPlan(series(Array.from({ length: 2000 }, () => 1)), { peak: 100, bottom: 600, recovery: 1900, drop: 0.5 });
    expect(long).toMatchObject({ period: "week", skipsRecovery: true });
  });

  it("gives the big moves more screen time, and adds up", () => {
    const days = series([100, 101, 80, 81]);
    const ms = pacing(closeCandles(days, 1, 3, "day"), 3000);
    expect(ms.reduce((a, b) => a + b, 0)).toBeCloseTo(3000);
    expect(ms[1]).toBeGreaterThan(ms[0] * 3); // the −20% day
  });
});

describe("the portfolio", () => {
  it("sells, holds and buys at the day's value", () => {
    const h = startHolding(1_000_000, 250_000, 100);
    expect(worth(h, 50)).toBe(750_000);
    expect(worth(decide(h, "sell", 50), 100)).toBe(750_000);
    expect(worth(decide(h, "buy", 50), 100)).toBe(1_500_000);
    expect(decide(h, "hold", 50)).toBe(h);
  });

  it("compares you with the plain paths", () => {
    const days = series([100, 50, 100]);
    const crash = { peak: 0, bottom: 1, recovery: 2, drop: 0.5 };
    const you = decide(startHolding(1000, 0, 100), "sell", 50);
    expect(outcomes(days, crash, 0, 2, 1000, 0, you)).toEqual({ you: 500, held: 1000, soldAtBottom: 500, boughtAtBottom: 1000 });
  });

  it("names how you did", () => {
    const o = { you: 500, held: 1000, soldAtBottom: 500, boughtAtBottom: 1200 };
    expect(verdict(o, ["sell"]).title).toBe("Paper hands");
    expect(verdict({ ...o, you: 1000 }, ["hold"]).title).toBe("Diamond hands");
    expect(verdict({ ...o, you: 1200 }, ["buy"]).title).toBe("Bought the dip");
  });
});
