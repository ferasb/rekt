import { describe, expect, it } from "vitest";
import { usMarketOpen } from "./hours";

// New York is UTC−4 in October (daylight time) and UTC−5 in January.
describe("US market hours", () => {
  it("are 9:30 to 16:00 New York time on weekdays", () => {
    expect(usMarketOpen(new Date("2026-10-22T13:29:00Z"))).toBe(false); // Thu 9:29
    expect(usMarketOpen(new Date("2026-10-22T13:30:00Z"))).toBe(true); // Thu 9:30
    expect(usMarketOpen(new Date("2026-10-22T19:59:00Z"))).toBe(true); // Thu 15:59
    expect(usMarketOpen(new Date("2026-10-22T20:00:00Z"))).toBe(false); // Thu 16:00
  });

  it("follow daylight saving time", () => {
    expect(usMarketOpen(new Date("2026-01-15T14:00:00Z"))).toBe(false); // Thu 9:00 EST
    expect(usMarketOpen(new Date("2026-01-15T15:00:00Z"))).toBe(true); // Thu 10:00 EST
  });

  it("are closed at weekends", () => {
    expect(usMarketOpen(new Date("2026-10-24T15:00:00Z"))).toBe(false); // Sat 11:00
    expect(usMarketOpen(new Date("2026-10-25T15:00:00Z"))).toBe(false); // Sun 11:00
  });
});
