// Numbers as text. Pure.

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usdCompact = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 });

/** $12,345.67. From a million up, $1.23M. */
export function money(value: number): string {
  if (Math.abs(value) >= 1_000_000) return usdCompact.format(value);
  // Avoid "-$0.00".
  return usd.format(Math.abs(value) < 0.005 ? 0 : value);
}

/** +$12.34 or −$12.34 (a real minus sign). */
export function signedMoney(value: number): string {
  if (Math.abs(value) < 0.005) return money(0);
  return (value > 0 ? "+" : "−") + money(Math.abs(value));
}

/** +12.3% or −12.3%, from a fraction. */
export function signedPercent(fraction: number, digits = 2): string {
  const value = fraction * 100;
  if (Math.abs(value) < 0.5 * 10 ** -digits) return (0).toFixed(digits) + "%";
  return (value > 0 ? "+" : "−") + Math.abs(value).toFixed(digits) + "%";
}

/** How many decimals a price needs: 2 from $1 up, more below, so tiny coins keep four significant digits. */
export function priceDecimals(price: number): number {
  if (!(price > 0) || price >= 1) return 2;
  return Math.min(12, Math.max(4, 3 - Math.floor(Math.log10(price))));
}

/** A price with the decimals it needs: 81,234.56, 0.2117, 0.000004380. */
export function price(value: number, decimals = priceDecimals(value)): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** A coin amount: 0.012345 BTC, 1.23M PEPE. */
export function amount(value: number): string {
  if (value >= 1_000_000) return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(value);
  if (value >= 1000) return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return value.toLocaleString("en-US", { maximumSignificantDigits: 5 });
}

/** 1:05, 0:30: a countdown. */
export function countdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** "just now", "5 min ago", "3 h ago", "2 days ago". */
export function ago(ms: number): string {
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.floor(h / 24)} days ago`;
}
