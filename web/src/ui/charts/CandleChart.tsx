import { CandlestickSeries, LineStyle, type IChartApi, type IPriceLine, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";
import { useEffect, useRef, useState } from "react";
import { liquidationPrice } from "../../game/money";
import { applyTrade, type Candle } from "../../market/candles";
import { fetchCandles } from "../../market/feeds";
import { useGame } from "../engine";
import { onTick } from "../prices";
import { cssColor, useTheme } from "../theme";
import { chartTheme, makeChart, priceFormat } from "./base";

const bar = (c: Candle) => ({ ...c, time: c.time as UTCTimestamp });

function seriesColors() {
  const up = cssColor("--up");
  const down = cssColor("--down");
  return { upColor: up, downColor: down, borderUpColor: up, borderDownColor: down, wickUpColor: up, wickDownColor: down };
}

/** The Trade room's chart (design.md §2.1): candles from the exchange, extended live, with your positions' lines. */
export function CandleChart({ asset, granularity }: { asset: string; granularity: number }) {
  const container = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [retry, setRetry] = useState(0);
  const theme = useTheme((s) => s.theme);
  const positions = useGame((s) => s.game.positions);

  useEffect(() => {
    chart.current = makeChart(container.current!);
    series.current = chart.current.addSeries(CandlestickSeries, seriesColors());
    return () => {
      chart.current?.remove();
      chart.current = series.current = null;
    };
  }, []);

  useEffect(() => {
    chart.current?.applyOptions(chartTheme());
    series.current?.applyOptions(seriesColors());
  }, [theme]);

  // History, then every trade.
  useEffect(() => {
    const abort = new AbortController();
    let candles: Candle[] | null = null;
    setState("loading");
    series.current?.setData([]);
    fetchCandles(asset, granularity, undefined, abort.signal)
      .then((loaded) => {
        candles = loaded;
        const last = loaded[loaded.length - 1];
        if (last) series.current?.applyOptions({ priceFormat: priceFormat(last.close) });
        series.current?.setData(loaded.map(bar));
        chart.current?.timeScale().scrollToRealTime();
        setState("ready");
      })
      .catch(() => {
        if (!abort.signal.aborted) setState("failed");
      });
    const stop = onTick((tick) => {
      if (tick.asset !== asset || !candles) return;
      const changed = applyTrade(candles, tick.price, tick.time / 1000, granularity);
      if (changed) series.current?.update(bar(changed));
    });
    return () => {
      abort.abort();
      stop();
    };
  }, [asset, granularity, retry]);

  // Your positions: entry and liquidation lines.
  useEffect(() => {
    const s = series.current;
    if (!s) return;
    const lines: IPriceLine[] = [];
    for (const p of positions) {
      if (p.asset !== asset) continue;
      const color = cssColor(p.side === "long" ? "--up" : "--down");
      lines.push(
        s.createPriceLine({ price: p.entryPrice, color, lineWidth: 1, lineStyle: LineStyle.Solid, axisLabelVisible: true, title: `${p.leverage}× ${p.side}` }),
        s.createPriceLine({ price: liquidationPrice(p), color: cssColor("--danger"), lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "💀 liq" }),
      );
    }
    return () => lines.forEach((l) => s.removePriceLine(l));
  }, [positions, asset, theme]);

  return (
    <div className="chart-box">
      <div className="chart" ref={container} />
      {state === "loading" && <p className="chart-note">Loading the chart…</p>}
      {state === "failed" && (
        <p className="chart-note">
          Couldn't load the chart.{" "}
          <button type="button" className="link" onClick={() => setRetry((n) => n + 1)}>
            Try again
          </button>
        </p>
      )}
    </div>
  );
}
