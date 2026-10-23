import type { Time } from "lightweight-charts";

// Dates for the History room's charts. They use day strings ("1929-10-29"), not unix seconds:
// the data starts in 1926, and the charts' timestamps can't go before 1970.

/** Unix seconds (midnight UTC) as "YYYY-MM-DD". */
export function dayString(time: number): string {
  return new Date(time * 1000).toISOString().slice(0, 10);
}

/** A chart's Time (a day string, a business-day object or unix seconds) as a Date, in UTC. */
export function timeToDate(t: Time): Date {
  if (typeof t === "string") return new Date(`${t}T00:00:00Z`);
  if (typeof t === "number") return new Date(t * 1000);
  return new Date(Date.UTC(t.year, t.month - 1, t.day));
}

const long = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const medium = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const monthYear = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

/** "Mon, Mar 16, 2020". */
export function longDate(time: number): string {
  return long.format(new Date(time * 1000));
}

/** "Mar 16, 2020". */
export function mediumDate(time: number): string {
  return medium.format(new Date(time * 1000));
}

/** "Mar 2020". */
export function monthDate(time: number): string {
  return monthYear.format(new Date(time * 1000));
}

/** "23 trading days", "1 year, 5 months", "16 years": how long something took, for people. */
export function span(fromTime: number, toTime: number, tradingDays?: number): string {
  const months = Math.round((toTime - fromTime) / (86_400 * 30.44));
  if (months < 3 && tradingDays !== undefined) return `${tradingDays} trading days`;
  if (months < 12) return `${months} month${months === 1 ? "" : "s"}`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years >= 5 || rest === 0) return `${years} year${years === 1 ? "" : "s"}`;
  return `${years} year${years === 1 ? "" : "s"}, ${rest} month${rest === 1 ? "" : "s"}`;
}
