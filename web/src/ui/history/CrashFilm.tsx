import { CandlestickSeries, ColorType, LineStyle, createChart, type IChartApi, type ISeriesApi, type Time } from "lightweight-charts";
import { useEffect, useMemo, useRef, useState } from "react";
import { featsOf } from "../../game/badges";
import type { CrashStory, Headline } from "../../game/crashes";
import { dollars, money, signedPercent } from "../../game/format";
import {
  candleFor,
  closeCandles,
  decide,
  decisionPoints,
  filmPlan,
  indexAt,
  outcomes,
  pacing,
  startHolding,
  verdict,
  worth,
  type Choice,
  type Crash,
  type Day,
  type Holding,
} from "../../game/history";
import type { FilmResult } from "../../persist/history";
import { fx, reducedMotion, toast } from "../fx/bus";
import { play } from "../fx/sound";
import { useModal } from "../modal";
import { cssColor } from "../theme";
import { useCountUp } from "../widgets";
import { dayString, longDate, mediumDate, monthDate, span, timeToDate } from "./time";

const SPEEDS = { slow: 1.6, normal: 1, fast: 0.5 } as const;
type Speed = keyof typeof SPEEDS;

/** How long a film takes at Normal speed: a beat per candle, within a minute or so. */
const filmMs = (candles: number) => Math.min(80_000, Math.max(35_000, candles * 350));

type Phase = "title" | "playing" | "paused" | "deciding" | "end";

interface Moment {
  /** The candle (by index) the film stops at. */
  at: number;
  prompt: string;
}

/**
 * A crash, filmed (docs/time-machine.md §3): a title card, then the candles play at the crash's own
 * pace, with your money, the headlines, and (when you ask for them) two moments where you decide.
 */
export function CrashFilm({
  days,
  crash,
  story,
  amount,
  reserve,
  real,
  decide: deciding,
  onResult,
  onClose,
}: {
  days: readonly Day[];
  crash: Crash;
  story: CrashStory | undefined;
  amount: number;
  reserve: number;
  /** In today's dollars: the money is labelled so. */
  real: boolean;
  /** Stop at the two decisions; off, the film plays straight through, holding. */
  decide: boolean;
  /** Once, when the film reaches its end. */
  onResult(result: FilmResult): void;
  onClose(): void;
}) {
  const plan = useMemo(() => filmPlan(days, crash), [days, crash]);
  const candles = useMemo(() => closeCandles(days, plan.from, plan.to, plan.period), [days, plan]);
  const v0 = days[plan.from - 1 >= 0 ? plan.from - 1 : plan.from].value;
  /** The market's value scaled to "what your amount would be worth held". */
  const scale = amount / v0;
  const peakValue = days[crash.peak].value;
  const name = story?.name ?? `The ${new Date(days[crash.peak].time * 1000).getUTCFullYear()} bear market`;

  // The two decisions, when stopping for them (game/history.ts).
  const moments = useMemo<Moment[]>(
    () =>
      deciding
        ? decisionPoints(days, crash, candles).map((p) => ({
            at: p.at,
            prompt: p.when === "falling" ? "The news is grim and getting worse." : "It's climbing back. Is it real this time?",
          }))
        : [],
    [candles, crash, days, deciding],
  );

  // Headlines, on the candle that holds their date.
  const headlines = useMemo(() => {
    const list: (Headline & { at: number })[] = [];
    for (const h of story?.headlines ?? []) {
      const at = candleFor(candles, plan.period, Date.parse(`${h.date}T00:00:00Z`) / 1000);
      if (at >= 0) list.push({ ...h, at });
    }
    const bottomAt = candles.findIndex((c) => c.time >= days[crash.bottom].time);
    if (bottomAt >= 0) list.push({ date: dayString(days[crash.bottom].time), text: `The bottom: ${Math.round(crash.drop * 100)}% below the high.`, at: bottomAt });
    if (!plan.skipsRecovery && crash.recovery !== null) list.push({ date: dayString(days[crash.recovery].time), text: "Back to the old high.", at: candles.length - 1 });
    return list.sort((a, b) => a.at - b.at);
  }, [candles, crash, days, plan.period, plan.skipsRecovery, story]);

  const [phase, setPhase] = useState<Phase>(reducedMotion() ? "playing" : "title");
  const [speed, setSpeed] = useState<Speed>("normal");
  const [shown, setShown] = useState(0); // candles on screen
  const [holding, setHolding] = useState<Holding>(() => startHolding(amount, reserve, v0));
  const [choices, setChoices] = useState<Choice[]>([]);
  const [headline, setHeadline] = useState<(Headline & { at: number }) | null>(null);

  const root = useRef<HTMLDivElement>(null);
  useModal(root);
  const titleCard = useRef<HTMLButtonElement>(null);
  const decisionBox = useRef<HTMLDivElement>(null);
  const endBox = useRef<HTMLDivElement>(null);
  const chartBox = useRef<HTMLDivElement>(null);
  /** The candles on screen, in your money; the rest of the frame is empty slots. */
  const drawn = useRef<{ time: Time; open: number; high: number; low: number; close: number }[]>([]);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const clock = useRef({ elapsed: 0, last: 0 });
  const durations = useMemo(() => pacing(candles, filmMs(candles.length)), [candles]);
  const ends = useMemo(() => durations.reduce<number[]>((acc, d) => [...acc, (acc.at(-1) ?? 0) + d], []), [durations]);
  const state = useRef({ phase, speed, shown, moments, headlines, momentsDone: 0, headlinesDone: 0 });
  state.current.phase = phase;
  state.current.speed = speed;

  // The chart: candles in "your money", the frame fixed to the whole film so they fill in left to right.
  useEffect(() => {
    const up = cssColor("--up");
    const down = cssColor("--down");
    const c = createChart(chartBox.current!, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: cssColor("--text-muted"), attributionLogo: true },
      grid: { vertLines: { visible: false }, horzLines: { color: cssColor("--chart-grid") } },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.22, bottom: 0.08 } },
      // No fixed edges: they pin the view to the newest candle, and the frame must stay the whole film.
      timeScale: { borderVisible: false, rightOffset: 0 },
      crosshair: { horzLine: { visible: false }, vertLine: { visible: false } },
      handleScroll: false,
      handleScale: false,
      localization: {
        timeFormatter: (t: Time) => mediumDate(timeToDate(t).getTime() / 1000),
        priceFormatter: (p: number) => money(p).replace(/\.\d\d$/, ""),
      },
    });
    const s = c.addSeries(CandlestickSeries, { upColor: up, downColor: down, borderUpColor: up, borderDownColor: down, wickUpColor: up, wickDownColor: down, priceLineVisible: false, lastValueVisible: true });
    s.createPriceLine({ price: amount, color: cssColor("--secondary"), lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "you started" });
    // Empty slots for every candle to come, so the frame is set from the first frame.
    drawn.current = [];
    s.setData(candles.map((k) => ({ time: dayString(k.time) as Time })));
    c.timeScale().setVisibleLogicalRange({ from: -0.5, to: candles.length - 0.5 });
    chart.current = c;
    series.current = s;
    return () => {
      c.remove();
      chart.current = series.current = null;
    };
  }, [amount, candles]);

  // Draws the candles revealed so far. The chart can't update a bar before its last one (the empty
  // slots run to the end), so the drawn candles and the remaining slots are set together: a few
  // hundred bars at most.
  const draw = () => {
    series.current?.setData([...drawn.current, ...candles.slice(drawn.current.length).map((c) => ({ time: dayString(c.time) as Time }))]);
    // Setting data scrolls to the newest bar; the frame stays the whole film.
    chart.current?.timeScale().setVisibleLogicalRange({ from: -0.5, to: candles.length - 0.5 });
  };

  // Reveals candle i, and what it triggers (silently, and drawn later in one go, when skipping to the end).
  const reveal = (i: number, quiet = false) => {
    const k = candles[i];
    drawn.current.push({ time: dayString(k.time) as Time, open: k.open * scale, high: k.high * scale, low: k.low * scale, close: k.close * scale });
    if (!quiet) draw();
    const s = state.current;
    while (s.headlinesDone < s.headlines.length && s.headlines[s.headlinesDone].at <= i) {
      const h = s.headlines[s.headlinesDone++];
      setHeadline(h);
      if (!quiet) play(h.text.startsWith("The bottom") ? "bottom" : "headline");
    }
    if (s.momentsDone < s.moments.length && s.moments[s.momentsDone].at === i) {
      s.momentsDone++;
      // Now, not on the next render: the clock's loop must stop at this candle.
      s.phase = "deciding";
      setPhase("deciding");
    }
  };

  // The playback clock.
  useEffect(() => {
    let frame = 0;
    clock.current.last = performance.now();
    const tick = (now: number) => {
      const c = clock.current;
      const dt = Math.min(now - c.last, 100); // a hidden tab doesn't fast-forward
      c.last = now;
      const s = state.current;
      if (s.phase === "playing") {
        c.elapsed += dt / SPEEDS[s.speed];
        let next = s.shown;
        while (next < candles.length && ends[next] <= c.elapsed && state.current.phase === "playing") reveal(next++);
        if (next !== s.shown) {
          s.shown = next;
          setShown(next);
        }
        if (next >= candles.length) setPhase("end");
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const onHide = () => document.hidden && state.current.phase === "playing" && setPhase("paused");
    document.addEventListener("visibilitychange", onHide);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onHide);
    };
    // reveal reads everything it needs from refs.
  }, [candles, ends]);

  // The title card, then the film.
  useEffect(() => {
    if (phase !== "title") return;
    play("whoosh");
    const timer = setTimeout(() => setPhase("playing"), 2800);
    return () => clearTimeout(timer);
  }, [phase]);

  // Focus follows the film: the title card, the decision, the ending; else the film itself, so it
  // never falls behind the overlay.
  useEffect(() => {
    const target = phase === "title" ? titleCard.current : phase === "deciding" ? decisionBox.current : phase === "end" ? endBox.current : null;
    if (target) target.focus({ preventScroll: true });
    else if (!root.current?.contains(document.activeElement)) root.current?.focus({ preventScroll: true });
  }, [phase]);

  // Headlines fade after a while.
  useEffect(() => {
    if (!headline) return;
    const timer = setTimeout(() => setHeadline((h) => (h === headline ? null : h)), 4500);
    return () => clearTimeout(timer);
  }, [headline]);

  const last = shown > 0 ? candles[shown - 1] : undefined;
  const value = last ? last.close : v0;
  /** Everything you have: the invested part at today's value, plus the cash. */
  const you = worth(holding, value);
  const start = amount + reserve;
  const youShown = useCountUp(you, 250);
  const fromHigh = Math.max(0, 1 - value / Math.max(peakValue, ...candles.slice(0, shown).map((c) => c.high)));
  const dayNumber = last ? indexAt(days, last.time) : plan.from;
  const sinceHigh = dayNumber - crash.peak;

  const choose = (choice: Choice) => {
    setHolding((h) => decide(h, choice, value));
    setChoices((c) => [...c, choice]);
    play(choice === "sell" ? "close" : choice === "buy" ? "open" : "tick");
    setPhase("playing");
  };

  // The end: you against the three plain paths.
  const endIndex = last ? indexAt(days, last.time) : plan.to;
  const result = phase === "end" ? outcomes(days, crash, plan.from - 1, endIndex, amount, reserve, holding) : null;
  const grade = result ? verdict(result, choices) : null;
  useEffect(() => {
    if (!result || !grade) return;
    onResult({ you: result.you, held: result.held, start: amount + reserve, title: grade.title, emoji: grade.emoji, choices, at: Date.now(), feats: featsOf({ ...result, choices }) });
    // Just watching: nothing to celebrate or mourn.
    if (choices.length === 0) return;
    if (result.you >= result.held) {
      fx({ type: "confetti", amount: result.you > result.held * 1.05 ? "lots" : "some" });
      play("bigwin");
    } else play("loss");
    // Once, when the film ends.
  }, [phase === "end"]);

  // Keys: space pauses, Esc leaves, 1/2/3 decide.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === " " && (phase === "playing" || phase === "paused")) {
        e.preventDefault();
        setPhase(phase === "playing" ? "paused" : "playing");
      }
      // 3 is Buy more, which needs cash, like its button.
      if (phase === "deciding" && ["1", "2", "3"].includes(e.key) && (e.key !== "3" || holding.cash > 0)) choose((["sell", "hold", "buy"] as const)[Number(e.key) - 1]);
      if (phase === "title" && (e.key === "Enter" || e.key === " ")) setPhase("playing");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const skipToEnd = () => {
    const s = state.current;
    s.moments = s.moments.slice(0, s.momentsDone); // no more decisions when skipping
    clock.current.elapsed = ends.at(-1)! + 1;
    for (let i = s.shown; i < candles.length; i++) reveal(i, true);
    draw();
    s.shown = candles.length;
    setShown(candles.length);
    setPhase("end");
  };

  const copy = async () => {
    if (!result || !grade) return;
    const text = `I lived through ${name} on rekt with ${dollars(amount)} and ended with ${dollars(Math.round(result.you))} (${grade.emoji} ${grade.title}). Holding would have made ${dollars(Math.round(result.held))}. https://rekt.ferasbisharat.com/#history`;
    try {
      await navigator.clipboard.writeText(text);
      toast("info", "Copied", "Paste it anywhere to brag.");
    } catch {
      toast("danger", "Couldn't copy", text);
    }
  };

  const best = result ? Math.max(result.you, result.held, result.soldAtBottom, result.boughtAtBottom) : 1;
  const paths = result
    ? [
        { label: "You", value: result.you, you: true },
        { label: "Held all along", value: result.held },
        { label: "Sold at the bottom", value: result.soldAtBottom },
        { label: "Bought at the bottom", value: result.boughtAtBottom },
      ]
    : [];
  const decision = phase === "deciding" ? moments[state.current.momentsDone - 1] : null;

  return (
    <div className={`film ${phase}`} ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`${name}, as a film`}>
      <div className="letterbox top" aria-hidden="true" />
      <div className="letterbox bottom" aria-hidden="true" />

      <div className="film-stage">
        <div className="film-hud">
          <div className="hud-date">
            <span className="hud-label">{plan.period === "day" ? longDate(last?.time ?? days[plan.from].time) : `Week of ${mediumDate(last?.time ?? days[plan.from].time)}`}</span>
            <span className="hud-name">{name}</span>
          </div>
          <div className="hud-money">
            <span className="hud-label">Your money{real ? ", in today's dollars" : ""}</span>
            <strong className={you >= start ? "up" : "down"}>{money(youShown)}</strong>
            <span className={`pnl ${you >= start ? "up" : "down"}`}>
              <span aria-hidden="true">{you >= start ? "▲ " : "▼ "}</span>
              {signedPercent(you / start - 1, 1)}
            </span>
            <span className="hud-cash">
              Invested {dollars(Math.round(holding.units * value))} · Cash {dollars(Math.round(holding.cash))}
            </span>
          </div>
          <div className="hud-drop" aria-label={`The market is ${Math.round(fromHigh * 100)}% below its high`}>
            <span className="hud-label">Below the high</span>
            <div className="drop-meter">
              <div className="drop-fill" style={{ width: `${Math.min(100, (fromHigh / Math.max(crash.drop, 0.01)) * 100)}%` }} />
            </div>
            <strong className="down">−{(fromHigh * 100).toFixed(1)}%</strong>
            <span className="muted">{sinceHigh <= 0 ? "Still at the high" : `${sinceHigh} trading day${sinceHigh === 1 ? "" : "s"} since the high`}</span>
          </div>
        </div>
        <div className="film-chart" ref={chartBox} />

        {headline && (
          <div className="headline" key={headline.date + headline.text} role="status">
            <span className="headline-date">{mediumDate(Date.parse(`${headline.date}T00:00:00Z`) / 1000)}</span>
            <span className="headline-text">{headline.text}</span>
          </div>
        )}
      </div>

      {phase === "title" && (
        <button type="button" className="title-card" ref={titleCard} onClick={() => setPhase("playing")} aria-label="Start the film">
          <span className="title-emoji" aria-hidden="true">
            {story?.emoji ?? "📉"}
          </span>
          <span className="title-when">{monthDate(days[crash.peak].time)}</span>
          <span className="title-name">{name}</span>
          {story && <span className="title-tag">{story.tagline}</span>}
          <span className="title-stake">
            You have <strong>{dollars(amount)}</strong> in the US stock market{reserve > 0 ? <>, and {dollars(reserve)} in cash.</> : "."}
          </span>
        </button>
      )}

      {decision && (
        <div className="decision" ref={decisionBox} tabIndex={-1} role="alertdialog" aria-labelledby="decision-title">
          <p className="decision-when">{longDate(last?.time ?? days[plan.from].time)}</p>
          <h2 id="decision-title">
            Your {dollars(start)} is now <span className={you >= start ? "up" : "down"}>{money(you)}</span> ({signedPercent(you / start - 1, 1)}).
          </h2>
          <p className="muted">{decision.prompt} What do you do?</p>
          <div className="decision-buttons">
            <button type="button" className="choice sell" onClick={() => choose("sell")}>
              <span aria-hidden="true">🏃</span> Sell everything
              <small>Get out, keep what's left</small>
              <kbd>1</kbd>
            </button>
            <button type="button" className="choice hold" onClick={() => choose("hold")}>
              <span aria-hidden="true">💎</span> Hold
              <small>Ride it out</small>
              <kbd>2</kbd>
            </button>
            <button type="button" className="choice buy" disabled={holding.cash <= 0} onClick={() => choose("buy")}>
              <span aria-hidden="true">🛒</span> Buy more
              <small>{holding.cash > 0 ? `Put in your ${dollars(Math.round(holding.cash))} cash` : "No cash left"}</small>
              <kbd>3</kbd>
            </button>
          </div>
        </div>
      )}

      {result && grade && (
        <div className="film-end" ref={endBox} tabIndex={-1} role="alertdialog" aria-labelledby="end-title">
          <span className="end-emoji" aria-hidden="true">
            {grade.emoji}
          </span>
          <h2 id="end-title">{grade.title}</h2>
          <p className="muted">
            {crash.recovery !== null
              ? `The market got back to its high on ${mediumDate(days[crash.recovery].time)}, ${span(days[crash.peak].time, days[crash.recovery].time)} after the peak.`
              : "The market hasn't got back to its high yet."}
            {plan.skipsRecovery && " (The film stops a while after the bottom.)"}
          </p>
          {!deciding && <p className="end-hint">Turn on “Stop to decide” to play it your way: sell, hold or buy more.</p>}
          <ul className="paths">
            {paths.map((p) => (
              <li key={p.label} className={p.you ? "you" : ""}>
                <span className="path-label">{p.label}</span>
                <span className="path-bar">
                  <span className={`path-fill ${p.value >= amount + reserve ? "up" : "down"}`} style={{ width: `${(p.value / best) * 100}%` }} />
                </span>
                <span className="path-value">{money(p.value)}</span>
              </li>
            ))}
          </ul>
          <p className="muted small">
            Each path starts with {dollars(amount)} invested and {dollars(reserve)} in cash on {mediumDate(days[plan.from].time)}, and ends on{" "}
            {mediumDate(days[endIndex].time)}.
          </p>
          <div className="end-buttons">
            <button type="button" className="chip" onClick={copy}>
              📋 Copy result
            </button>
            <button type="button" className="go" onClick={onClose}>
              Back to history
            </button>
          </div>
        </div>
      )}

      <div className="film-controls">
        {(phase === "playing" || phase === "paused") && (
          <>
            <button type="button" className="icon" onClick={() => setPhase(phase === "playing" ? "paused" : "playing")} aria-label={phase === "playing" ? "Pause" : "Play"}>
              <span aria-hidden="true">{phase === "playing" ? "⏸" : "▶"}</span>
            </button>
            <div className="presets" role="radiogroup" aria-label="Speed">
              {(Object.keys(SPEEDS) as Speed[]).map((s) => (
                <button key={s} type="button" role="radio" aria-checked={s === speed} className="chip" onClick={() => setSpeed(s)}>
                  {s === "slow" ? "Slow" : s === "normal" ? "Normal" : "Fast"}
                </button>
              ))}
            </div>
            <button type="button" className="chip" onClick={skipToEnd}>
              ⏭ Skip to the end
            </button>
          </>
        )}
        <span className="film-progress" aria-hidden="true">
          <span style={{ width: `${(shown / candles.length) * 100}%` }} />
        </span>
        <button type="button" className="icon film-close" onClick={onClose} aria-label="Close the film">
          ✕
        </button>
      </div>
    </div>
  );
}
