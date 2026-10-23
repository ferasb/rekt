import { describe, expect, it } from "vitest";
import { badges, featsOf } from "../game/badges";
import { keepBest, parseResults, type FilmResult } from "./history";

const result = (r: Partial<FilmResult> = {}): FilmResult => {
  const base = { you: 1.4e6, held: 1.1e6, start: 1.25e6, title: "Bought the dip", emoji: "🦅", choices: ["buy", "hold"] as FilmResult["choices"], at: 1, ...r };
  return { ...base, feats: r.feats ?? featsOf(base) };
};
const watched = result({ you: 1.1e6, held: 1.1e6, choices: [], title: "Just watching", emoji: "🍿" });
const heldOn = result({ you: 1.1e6, held: 1.1e6, choices: ["hold", "hold"], title: "Diamond hands", emoji: "💎" });

describe("saved History results", () => {
  it("round-trip, and drop what isn't a result", () => {
    const saved = { "2020-02-19": result(), "1929-09-03:real": result({ choices: ["hold"] }) };
    expect(parseResults(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
    expect(parseResults({ "not a date": result(), "2020-02-19": { ...result(), you: "lots" }, "2008-01-01": { ...result(), choices: ["panic"] } })).toEqual({});
    expect(parseResults(null)).toEqual({});
  });

  it("work out the feats of results saved before there were any", () => {
    const { feats: _, ...old } = result();
    expect(parseResults({ "2020-02-19": old })["2020-02-19"].feats).toEqual(["dip", "beat"]);
    expect(parseResults({ "2020-02-19": { ...old, feats: ["diamond", "nonsense"] } })["2020-02-19"].feats).toEqual(["diamond"]);
  });

  it("prefer, on a tie, the result where you decided: holding all the way ends level with watching", () => {
    const after = keepBest({ "2020-02-19": watched }, "2020-02-19", heldOn);
    expect(after["2020-02-19"].title).toBe("Diamond hands");
    expect(keepBest(after, "2020-02-19", watched)).toBe(after);
  });

  it("keep a crash's feats when a better result replaces the one that earned them", () => {
    const first = keepBest({}, "2020-02-19", heldOn);
    const better = keepBest(first, "2020-02-19", result({ you: 1.5e6, choices: ["sell", "buy"] }));
    expect(better["2020-02-19"].you).toBe(1.5e6);
    expect(better["2020-02-19"].feats).toEqual(["diamond", "dip", "beat"]);
    // A worse play still adds what it achieved.
    const best = keepBest({}, "2020-02-19", result({ you: 1.5e6 }));
    expect(keepBest(best, "2020-02-19", heldOn)["2020-02-19"]).toMatchObject({ you: 1.5e6, feats: ["diamond", "dip", "beat"] });
  });

  it("keep the best per crash, as a multiple of the start", () => {
    const one = keepBest({}, "2020-02-19", result({ you: 1.3e6 }));
    expect(keepBest(one, "2020-02-19", result({ you: 1.2e6 }))).toBe(one);
    expect(keepBest(one, "2020-02-19", result({ you: 1.5e6 }))["2020-02-19"].you).toBe(1.5e6);
  });
});

describe("badges", () => {
  it("are earned from results", () => {
    const earned = (results: Parameters<typeof badges>[0], famous: string[] = []) => badges(results, famous).filter((b) => b.earned).map((b) => b.id);
    expect(earned({})).toEqual([]);
    expect(earned({ "2020-02-19": result() })).toEqual(["first", "dip"]);
    expect(earned({ "2020-02-19": result({ choices: ["hold", "hold"], you: 1e6 }) })).toEqual(["first", "diamond"]);
    const three = { "2020-02-19": result(), "2007-10-09": result(), "1929-09-03": result() };
    expect(earned(three, Object.keys(three))).toEqual(["first", "dip", "beat", "all", "great"]);
    // Watching, however well the market did, isn't beating it.
    expect(earned({ a: watched, b: watched, c: watched })).toEqual(["first"]);
  });
});
