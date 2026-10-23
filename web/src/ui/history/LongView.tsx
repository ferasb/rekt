import { AreaSeries, ColorType, PriceScaleMode, createChart, type IChartApi, type ISeriesApi, type Time } from "lightweight-charts";
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import type { CrashStory } from "../../game/crashes";
import { filmPlan, type Crash, type Day } from "../../game/history";
import { reducedMotion } from "../fx/bus";
import { cssColor, useTheme } from "../theme";
import { dayString, mediumDate, span, timeToDate } from "./time";

export interface LongViewHandle {
  /** Flies the camera into a crash's film window; resolves when it's there. */
  dive(crash: Crash): Promise<void>;
  /** Flies back out to the whole century. */
  surface(): Promise<void>;
}

interface Band {
  index: number;
  /** Pixels from the chart's left: the peak, the bottom, the recovery (or the right edge). */
  peak: number;
  bottom: number;
  end: number;
}

const usd = (v: number) =>
  v >= 1000 ? `$${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v)}` : `$${v < 10 ? v.toFixed(2) : v.toFixed(0)}`;

function chartColors() {
  return {
    layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: cssColor("--text-muted") },
    grid: { vertLines: { visible: false }, horzLines: { color: cssColor("--chart-grid") } },
    line: { lineColor: cssColor("--primary"), topColor: cssColor("--primary", 0.35), bottomColor: cssColor("--primary", 0.02) },
  };
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * The long view (docs/time-machine.md §2): a century of the US market on a log scale, with every crash
 * as a red band (the fall solid, the climb back faint). Bands are buttons: point at one for its card,
 * press it to dive in.
 */
export function LongView({
  days,
  crashes,
  stories,
  onPick,
  ref,
}: {
  days: readonly Day[];
  crashes: readonly Crash[];
  stories: ReadonlyMap<number, CrashStory>;
  onPick(index: number): void;
  ref: Ref<LongViewHandle>;
}) {
  const box = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<"Area"> | null>(null);
  const [bands, setBands] = useState<Band[]>([]);
  const [hovered, setHovered] = useState<number | null>(null);
  const [diving, setDiving] = useState(false);
  const theme = useTheme((s) => s.theme);
  // For the chart's own click and hover events, made once: always the latest props.
  const latest = useRef({ crashes, onPick });
  latest.current = { crashes, onPick };

  // Where each band is on screen: recomputed whenever the view moves.
  const place = () => {
    const c = chart.current;
    if (!c) return;
    const x = (i: number) => c.timeScale().timeToCoordinate(dayString(days[i].time) as Time) ?? NaN;
    const width = c.timeScale().width();
    setBands(
      crashes
        .map((crash, index) => ({ index, peak: x(crash.peak), bottom: x(crash.bottom), end: crash.recovery !== null ? x(crash.recovery) : width }))
        .filter((b) => Number.isFinite(b.peak) && b.end > -20 && b.peak < width + 20),
    );
  };

  useEffect(() => {
    const c = createChart(box.current!, {
      autoSize: true,
      ...chartColors(),
      rightPriceScale: { mode: PriceScaleMode.Logarithmic, borderVisible: false, scaleMargins: { top: 0.18, bottom: 0.04 } },
      timeScale: { borderVisible: false, rightOffset: 2, minBarSpacing: 0.001 },
      crosshair: { horzLine: { visible: false }, vertLine: { labelBackgroundColor: cssColor("--highlight") } },
      localization: {
        timeFormatter: (t: Time) => mediumDate(timeToDate(t).getTime() / 1000),
        priceFormatter: usd,
      },
      handleScale: { axisPressedMouseMove: { time: true, price: false } },
    });
    const s = c.addSeries(AreaSeries, { ...chartColors().line, lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
    s.setData(days.map((d) => ({ time: dayString(d.time) as Time, value: d.value })));
    c.timeScale().fitContent();
    chart.current = c;
    series.current = s;
    c.timeScale().subscribeVisibleLogicalRangeChange(place);
    // The chart's canvas is on top of the bands, so a click or hover on the chart is looked up by
    // day: dragging and zooming keep working, and the bands stay buttons for the keyboard.
    const crashAt = (logical: number | undefined) => {
      if (logical === undefined) return null;
      const i = Math.round(logical);
      const index = latest.current.crashes.findIndex((cr) => i >= cr.peak && i <= (cr.recovery ?? days.length - 1));
      return index === -1 ? null : index;
    };
    c.subscribeClick((param) => {
      const index = crashAt(param.logical);
      if (index !== null) latest.current.onPick(index);
    });
    c.subscribeCrosshairMove((param) => {
      const index = crashAt(param.logical);
      setHovered(index);
      box.current!.style.cursor = index !== null ? "pointer" : "";
    });
    const resize = new ResizeObserver(() => requestAnimationFrame(place));
    resize.observe(box.current!);
    requestAnimationFrame(place);
    return () => {
      resize.disconnect();
      c.remove();
      chart.current = series.current = null;
    };
    // Made once: the data never changes while the room is open.
  }, []);

  useEffect(() => {
    const colors = chartColors();
    chart.current?.applyOptions({ layout: colors.layout, grid: colors.grid });
    series.current?.applyOptions(colors.line);
  }, [theme]);

  /** Animates the visible range (in data indexes) to a target. */
  const fly = (from: number, to: number, ms: number) =>
    new Promise<void>((resolve) => {
      const ts = chart.current?.timeScale();
      const start = ts?.getVisibleLogicalRange();
      if (!ts || !start || reducedMotion()) {
        ts?.setVisibleLogicalRange({ from, to });
        return resolve();
      }
      const t0 = performance.now();
      const step = (now: number) => {
        const k = ease(Math.min(1, (now - t0) / ms));
        ts.setVisibleLogicalRange({ from: start.from + (from - start.from) * k, to: start.to + (to - start.to) * k });
        if (k < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });

  useImperativeHandle(ref, () => ({
    async dive(crash) {
      setHovered(null);
      setDiving(true);
      const plan = filmPlan(days, crash);
      const pad = (plan.to - plan.from) * 0.04;
      await fly(plan.from - pad, plan.to + pad, 1000);
    },
    async surface() {
      await fly(0, days.length - 1, 900);
      setDiving(false);
    },
  }));

  // Labels in rows, so neighbours never overlap: each goes in the first row with room left of it.
  const LABEL_WIDTH = 96;
  const rowEnds: number[] = [];
  const labelRow = new Map<number, number>();
  for (const b of [...bands].filter((b) => stories.has(b.index)).sort((x, y) => x.peak - y.peak)) {
    let row = rowEnds.findIndex((end) => b.peak - LABEL_WIDTH / 2 > end + 6);
    if (row === -1) row = rowEnds.length;
    rowEnds[row] = b.peak + LABEL_WIDTH / 2;
    labelRow.set(b.index, row);
  }

  const card = hovered !== null ? crashes[hovered] : null;
  const cardBand = bands.find((b) => b.index === hovered);
  const width = chart.current?.timeScale().width() ?? 0;

  return (
    <div className={`long-view ${diving ? "diving" : ""}`}>
      <div className="long-chart" ref={box} />
      <div className="bands" aria-label="Crashes">
        {bands.map((b) => {
          const crash = crashes[b.index];
          const story = stories.get(b.index);
          const fall = Math.max(6, b.bottom - b.peak);
          return (
            <button
              key={b.index}
              type="button"
              className={`band ${story ? "famous" : ""} ${hovered === b.index ? "hot" : ""}`}
              style={{ left: b.peak, width: Math.max(fall, b.end - b.peak) }}
              onMouseEnter={() => setHovered(b.index)}
              onMouseLeave={() => setHovered((h) => (h === b.index ? null : h))}
              onFocus={() => setHovered(b.index)}
              onBlur={() => setHovered((h) => (h === b.index ? null : h))}
              onClick={() => onPick(b.index)}
              aria-label={`${story?.name ?? "Crash"} from ${mediumDate(days[crash.peak].time)}: down ${Math.round(crash.drop * 100)}%. Play it.`}
            >
              <span className="band-fall" style={{ width: fall }} />
              {story && (
                <span className={`band-label ${b.peak < LABEL_WIDTH / 2 ? "edge" : ""}`} style={{ top: 8 + (labelRow.get(b.index) ?? 0) * 30 }}>
                  <span aria-hidden="true">{story.emoji}</span> {new Date(days[crash.peak].time * 1000).getUTCFullYear()}
                  <strong>−{Math.round(crash.drop * 100)}%</strong>
                </span>
              )}
            </button>
          );
        })}
      </div>
      {card && cardBand && (
        <div className="crash-card-tip" style={{ left: Math.min(Math.max(8, cardBand.peak - 20), width - 248) }} role="tooltip">
          <strong>
            {stories.get(hovered!)?.emoji} {stories.get(hovered!)?.name ?? `The ${new Date(days[card.peak].time * 1000).getUTCFullYear()} bear market`}
          </strong>
          <span className="tip-drop">−{(card.drop * 100).toFixed(1)}%</span>
          <dl>
            <div>
              <dt>The high</dt>
              <dd>{mediumDate(days[card.peak].time)}</dd>
            </div>
            <div>
              <dt>The bottom</dt>
              <dd>
                {mediumDate(days[card.bottom].time)} <span className="muted">({span(days[card.peak].time, days[card.bottom].time, card.bottom - card.peak)} down)</span>
              </dd>
            </div>
            <div>
              <dt>Back to the high</dt>
              <dd>{card.recovery !== null ? `${span(days[card.peak].time, days[card.recovery].time)} later` : "Not yet"}</dd>
            </div>
          </dl>
          <span className="tip-cta">Tap to live through it ▶</span>
        </div>
      )}
    </div>
  );
}
