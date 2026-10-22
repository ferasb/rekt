// US stock market hours, for the xStocks' "market closed" note (design.md §6.3). Pure.

const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "numeric", hourCycle: "h23" });

/**
 * Whether the New York Stock Exchange's regular session is open at this moment: weekdays, 9:30 to
 * 16:00 New York time. Holidays aren't counted, so on one this says open.
 */
export function usMarketOpen(date: Date): boolean {
  const p = Object.fromEntries(parts.formatToParts(date).map((x) => [x.type, x.value]));
  if (p.weekday === "Sat" || p.weekday === "Sun") return false;
  const minutes = Number(p.hour) * 60 + Number(p.minute);
  return minutes >= 9 * 60 + 30 && minutes < 16 * 60;
}
