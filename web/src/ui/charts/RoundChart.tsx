import { AreaSeries, LineStyle, type IChartApi, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";
import { useEffect, useRef } from "react";
import type { Round } from "../../game/game";
import { onTick, recentPoints, type Point } from "../prices";
import { cssColor, useTheme } from "../theme";
import { chartTheme, makeChart, priceFormat } from "./base";

/** Points (seconds) after which the chart stops fitting them all and scrolls instead. */
const FIT_UNTIL = 180;

const point = (p: Point) => ({ time: p.time as UTCTimestamp, value: p.price });

function seriesColors() {
  return { lineColor: cssColor("--primary"), topColor: cssColor("--primary", 0.3), bottomColor: cssColor("--primary", 0.02), lineWidth: 2 as const };
}

/** Up or Down's chart (design.md §2.2): a point a second since the page opened, and the round's start price. */
export function RoundChart({ asset, round }: { asset: string; round: Round | null }) {
  const container = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<"Area"> | null>(null);
  const theme = useTheme((s) => s.theme);

  useEffect(() => {
    chart.current = makeChart(container.current!, true);
    series.current = chart.current.addSeries(AreaSeries, { ...seriesColors(), priceLineVisible: true });
    return () => {
      chart.current?.remove();
      chart.current = series.current = null;
    };
  }, []);

  useEffect(() => {
    chart.current?.applyOptions(chartTheme());
    series.current?.applyOptions(seriesColors());
  }, [theme]);

  useEffect(() => {
    const points = recentPoints(asset);
    const last = points[points.length - 1];
    if (last) series.current?.applyOptions({ priceFormat: priceFormat(last.price) });
    series.current?.setData(points.map(point));
    // Until there's a few minutes of points, stretch them across the chart instead of bunching at the right.
    let count = points.length;
    const fit = () => (count < FIT_UNTIL ? chart.current?.timeScale().fitContent() : undefined);
    fit();
    let formatted = last !== undefined;
    let lastTime = last?.time ?? 0;
    return onTick((tick) => {
      if (tick.asset !== asset) return;
      if (!formatted) {
        series.current?.applyOptions({ priceFormat: priceFormat(tick.price) });
        formatted = true;
      }
      // The library refuses points older than its last one; a late trade just doesn't draw.
      const time = Math.floor(tick.time / 1000);
      if (time < lastTime) return;
      if (time > lastTime) count += 1;
      lastTime = time;
      series.current?.update(point({ time, price: tick.price }));
      fit();
    });
  }, [asset]);

  useEffect(() => {
    const s = series.current;
    if (!s || !round || round.asset !== asset) return;
    const line = s.createPriceLine({
      price: round.startPrice,
      color: cssColor("--secondary"),
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: `start (${round.call})`,
    });
    return () => s.removePriceLine(line);
  }, [round, asset, theme]);

  return (
    <div className="chart-box">
      <div className="chart" ref={container} />
    </div>
  );
}
