import { ColorType, CrosshairMode, createChart, type DeepPartial, type ChartOptions, type IChartApi, type Time, TickMarkType } from "lightweight-charts";
import { priceDecimals } from "../../game/format";
import { cssColor } from "../theme";

const time = (t: Time) => new Date((t as number) * 1000);

/** The charts' colors and fonts from the current theme's tokens (tokens.css). */
export function chartTheme(): DeepPartial<ChartOptions> {
  const text = cssColor("--text-muted");
  const grid = cssColor("--chart-grid");
  return {
    layout: {
      background: { type: ColorType.Solid, color: cssColor("--chart-bg") },
      textColor: text,
      fontFamily: getComputedStyle(document.documentElement).getPropertyValue("--font-ui"),
      // The TradingView link the library's licence asks for (also on the About page).
      attributionLogo: true,
    },
    grid: { vertLines: { color: grid }, horzLines: { color: grid } },
    rightPriceScale: { borderColor: cssColor("--border-muted") },
    timeScale: { borderColor: cssColor("--border-muted") },
    crosshair: {
      vertLine: { color: cssColor("--highlight"), labelBackgroundColor: cssColor("--highlight") },
      horzLine: { color: cssColor("--highlight"), labelBackgroundColor: cssColor("--highlight") },
    },
  };
}

/** A chart that fills its container, in local time (the library shows UTC by default). */
export function makeChart(container: HTMLElement, seconds = false): IChartApi {
  return createChart(container, {
    autoSize: true,
    ...chartTheme(),
    crosshair: { ...chartTheme().crosshair, mode: CrosshairMode.Magnet },
    localization: {
      timeFormatter: (t: Time) => time(t).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: seconds ? "2-digit" : undefined }),
    },
    timeScale: {
      ...chartTheme().timeScale,
      timeVisible: true,
      secondsVisible: seconds,
      rightOffset: 4,
      tickMarkFormatter: (t: Time, type: TickMarkType) => {
        const d = time(t);
        if (type === TickMarkType.Year) return String(d.getFullYear());
        if (type === TickMarkType.Month) return d.toLocaleString(undefined, { month: "short" });
        if (type === TickMarkType.DayOfMonth) return d.toLocaleString(undefined, { month: "short", day: "numeric" });
        if (type === TickMarkType.TimeWithSeconds) return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
      },
    },
    handleScale: { axisPressedMouseMove: { time: true, price: false } },
  });
}

/** The price axis's format for a coin at this price: enough decimals for tiny coins. */
export function priceFormat(price: number) {
  const precision = priceDecimals(price);
  return { type: "price" as const, precision, minMove: 10 ** -precision };
}
