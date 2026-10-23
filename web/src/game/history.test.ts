import { describe, expect, it } from "vitest";
import usMarket from "../market/history/us-market.json";
import { matchStories } from "./crashes";
import { candleFor, closeCandles, decide, decisionPoints, decodeHistory, filmPlan, findCrashes, inTodaysDollars, indexAt, outcomes, pacing, startHolding, verdict, worth, type Day, type HistoryFile } from "./history";

const DAY = 86_400;
/** Days from a list of values, one a day from 2020-01-01. */
const series = (values: number[]): Day[] =>
  values.map((value, i) => ({ time: Date.UTC(2020, 0, 1) / 1000 + i * DAY, value, ret: i ? value / values[i - 1] - 1 : 0 }));

describe("the data file", () => {
  it("decodes into growing values and real dates", () => {
    const file: HistoryFile = { source: "", from: "2020-01-02", to: "", gaps: [0, 1, 3], bp: [0, 1000, -500], cpi: { from: "2020-01", source: "", values: [100] } };
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

describe("every famous film", () => {
  const file = usMarket as HistoryFile;
  const nominal = decodeHistory(file);
  for (const [mode, days] of [
    ["in dollars of the time", nominal],
    ["in today's dollars", inTodaysDollars(nominal, file)],
  ] as const) {
    const crashes = findCrashes(days);
    const stories = matchStories(crashes.map((c) => ({ peak: days[c.peak].time, bottom: days[c.bottom].time })));
    for (const [i, story] of stories) {
      const crash = crashes[i];
      const plan = filmPlan(days, crash);
      const candles = closeCandles(days, plan.from, plan.to, plan.period);

      it(`stops twice for ${story.name} ${mode}: falling, then climbing`, () => {
        const points = decisionPoints(days, crash, candles);
        expect(points.map((p) => p.when)).toEqual(["falling", "climbing"]);
        expect(candles[points[0].at].time).toBeLessThanOrEqual(days[crash.bottom].time);
        expect(candles[points[1].at].time).toBeGreaterThan(days[crash.bottom].time);
        expect(points[1].at).toBeLessThan(candles.length - 1);
      });

      it(`shows every headline of ${story.name} ${mode} in its own week or on the next trading day`, () => {
        for (const h of story.headlines) {
          const t = Date.parse(`${h.date}T00:00:00Z`) / 1000;
          const at = candleFor(candles, plan.period, t);
          expect(at, h.text).toBeGreaterThanOrEqual(0);
          const gap = candles[at].time - t;
          if (plan.period === "day") expect(gap, h.text).toBeLessThanOrEqual(4 * DAY);
          else expect(Math.abs(gap), h.text).toBeLessThan(7 * DAY);
        }
      });
    }
  }
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
    expect(verdict({ ...o, you: 1000 }, []).title).toBe("Just watching"); // skipped every decision
  });
});

describe("today's dollars", () => {
  const file = usMarket as HistoryFile;
  const days = decodeHistory(file);
  const real = inTodaysDollars(days, file);
  const year = (y: number) => days.findIndex((d) => new Date(d.time * 1000).getUTCFullYear() === y);

  it("are today's: the CPI reaches the market data's last month", () => {
    const [y0, m0] = file.cpi.from.split("-").map(Number);
    const [y1, m1] = file.to.split("-").map(Number);
    expect(file.cpi.values.length).toBeGreaterThanOrEqual((y1 - y0) * 12 + m1 - m0 + 1);
    expect(file.cpi.values.every((v) => typeof v === "number" && v > 0)).toBe(true);
  });

  it("leave the last day alone and scale old days by the prices since", () => {
    expect(real.at(-1)!.value).toBeCloseTo(days.at(-1)!.value);
    // Prices rose about 19-fold since 1926, so a 1926 dollar is worth about $19 today.
    expect(real[0].value / days[0].value).toBeGreaterThan(15);
    expect(real[0].value / days[0].value).toBeLessThan(25);
  });

  it("make the 1970s a deeper crash than in dollars of the time", () => {
    const worst = (list: ReturnType<typeof findCrashes>, from: number, to: number) => Math.max(...list.filter((c) => c.peak >= year(from) && c.peak < year(to)).map((c) => c.drop));
    expect(worst(findCrashes(real), 1965, 1974)).toBeGreaterThan(worst(findCrashes(days), 1965, 1974) + 0.05);
  });

  it("still find the famous crashes, merging those that become one long fall", () => {
    const crashes = findCrashes(real);
    const names = [...matchStories(crashes.map((c) => ({ peak: real[c.peak].time, bottom: real[c.bottom].time }))).values()].map((s) => s.name);
    expect(names).toEqual(expect.arrayContaining(["The Great Crash", "Oil Shock", "Black Monday", "Dot-com Bust → Financial Crisis", "COVID Crash"]));
  });

  it("keep the stories a merged crash is made of, each with its own article", () => {
    const crashes = findCrashes(real);
    const merged = [...matchStories(crashes.map((c) => ({ peak: real[c.peak].time, bottom: real[c.bottom].time }))).values()].find((s) => s.parts);
    expect(merged?.parts?.map((p) => p.wiki)).toEqual(["https://en.wikipedia.org/wiki/Dot-com_bubble", "https://en.wikipedia.org/wiki/2008_financial_crisis"]);
  });

  it("match every story in dollars of the time, one each", () => {
    const crashes = findCrashes(days);
    const stories = matchStories(crashes.map((c) => ({ peak: days[c.peak].time, bottom: days[c.bottom].time })));
    expect([...stories.values()].map((s) => s.name).sort()).toEqual(
      ["Black Monday", "COVID Crash", "Dot-com Bust", "Financial Crisis", "Inflation Bear", "Oil Shock", "The Great Crash"],
    );
  });
});
