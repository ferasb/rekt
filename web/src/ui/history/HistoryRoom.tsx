import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { badges } from "../../game/badges";
import { matchStories, type CrashStory } from "../../game/crashes";
import { dollars } from "../../game/format";
import { decodeHistory, findCrashes, inTodaysDollars, indexAt, type Day, type HistoryFile } from "../../game/history";
import { DECIDE_KEY, keepBest, loadResults, REAL_KEY, saveResults, STAKE_KEY, TOUR_KEY, type FilmResult, type Results } from "../../persist/history";
import { Dialog } from "../Dialogs";
import { reducedMotion } from "../fx/bus";
import { useModal } from "../modal";
import { useCountUp } from "../widgets";
import { hashParam } from "../rooms";
import { CrashFilm } from "./CrashFilm";
import { LongView, type LongViewHandle } from "./LongView";
import { dayString, mediumDate, span } from "./time";

// The stake: from the address (#history?amount=250000), else the visitor's last pick, else $1,000,000.
const PRESETS = [1_000, 10_000, 100_000, 1_000_000];
/** The cash you also hold, for buying the dip: a quarter of the stake. */
const RESERVE = 0.25;

const validStake = (n: number) => Number.isFinite(n) && n >= 100 && n <= 1_000_000_000;

function initialStake(): number {
  const fromHash = Number(hashParam("amount"));
  if (validStake(fromHash)) return fromHash;
  try {
    const saved = Number(localStorage.getItem(STAKE_KEY));
    if (validStake(saved)) return saved;
  } catch {
    // Storage blocked: the default.
  }
  return 1_000_000;
}

function StakeChip({ stake, onChange, chipRef }: { stake: number; onChange(n: number): void; chipRef: RefObject<HTMLDivElement | null> }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(String(stake));
  return (
    <div className="stake" ref={chipRef}>
      <button type="button" className="stake-chip" aria-expanded={open} onClick={() => setOpen(!open)}>
        Starting with <strong>{dollars(stake)}</strong> <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="stake-pop" role="dialog" aria-label="Choose your stake">
          <div className="presets">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                className="chip"
                aria-pressed={p === stake}
                onClick={() => {
                  onChange(p);
                  setText(String(p));
                  setOpen(false);
                }}
              >
                {dollars(p)}
              </button>
            ))}
          </div>
          <form
            className="stake-own"
            onSubmit={(e) => {
              e.preventDefault();
              const n = Number(text.replace(/[^0-9.]/g, ""));
              if (validStake(n)) {
                onChange(n);
                setOpen(false);
              }
            }}
          >
            <label htmlFor="stake-own">Or your own</label>
            <div className="money-input">
              <span aria-hidden="true">$</span>
              <input id="stake-own" inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} />
            </div>
            <button type="submit" className="chip">
              Set
            </button>
          </form>
          <p className="muted small">Plus {dollars(stake * RESERVE)} in cash, for buying the dip.</p>
        </div>
      )}
    </div>
  );
}

/** "If you'd put $X in on [month], today you'd have $Y": and the worst fall you'd have sat through. */
function WhatIf({ days, stake, real }: { days: readonly Day[]; stake: number; real: boolean }) {
  const first = dayString(days[0].time).slice(0, 7);
  const last = dayString(days[days.length - 1].time).slice(0, 7);
  // What's typed (browsers without a month picker show a text box, which must be free to edit), and
  // the last whole month in range, which the sum uses.
  const [typed, setTyped] = useState("2000-01");
  const [month, setMonth] = useState("2000-01");
  const type = (text: string) => {
    setTyped(text);
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(text) && text >= first && text <= last) setMonth(text);
  };
  const t = Date.parse(`${month}-01T00:00:00Z`) / 1000;
  const from = Number.isFinite(t) ? Math.min(days.length - 1, indexAt(days, t) + (days[indexAt(days, t)].time < t ? 1 : 0)) : 0;
  const end = days[days.length - 1];
  const result = (stake * end.value) / days[from].value;
  let peak = days[from].value;
  let worst = 0;
  for (let i = from; i < days.length; i++) {
    peak = Math.max(peak, days[i].value);
    worst = Math.max(worst, 1 - days[i].value / peak);
  }
  const shown = useCountUp(result, 700);
  return (
    <section className="panel what-if" aria-label="What if">
      <p>
        If you'd put <strong>{dollars(stake)}</strong> in on{" "}
        <input type="month" aria-label="Month you'd have started" value={typed} min={first} max={last} onChange={(e) => type(e.target.value)} />, by{" "}
        {mediumDate(end.time)} you'd have
      </p>
      <p className="what-if-result">
        <strong className={result >= stake ? "up" : "down"}>{dollars(Math.round(shown))}</strong>
        <span className="muted">
          {" "}
          ×{(result / stake).toFixed(1)}
          {real ? " in today's dollars" : ""}, dividends reinvested
        </span>
      </p>
      <p className="muted small">
        Along the way, you'd have watched it fall as much as <strong className="down">−{Math.round(worst * 100)}%</strong> from a high, and had to hold on.
      </p>
    </section>
  );
}

/** A famous crash's info popup: what happened, in a few sentences, a link to read more, and a way in. */
function CrashInfo({ story, facts, onPlay, onClose }: { story: CrashStory; facts: string; onPlay(): void; onClose(): void }) {
  const parts = story.parts ?? [story];
  return (
    <Dialog title={`${story.emoji} ${story.name}`} onClose={onClose}>
      <p className="crash-info-facts muted small">{facts}</p>
      {parts.map((p) => (
        <section key={p.peak} className="crash-info-part">
          {parts.length > 1 && (
            <h3>
              <span aria-hidden="true">{p.emoji}</span> {p.name}
            </h3>
          )}
          <p>{p.about}</p>
          <a href={p.wiki} target="_blank" rel="noopener noreferrer">
            {parts.length > 1 ? `${p.name} on Wikipedia` : "Read more on Wikipedia"} <span aria-hidden="true">↗</span>
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </section>
      ))}
      <div className="dialog-actions">
        <button type="button" className="link" onClick={(e) => e.currentTarget.closest("dialog")?.close()}>
          Close
        </button>
        <button type="button" className="go" data-autofocus onClick={onPlay}>
          ▶ Live through it
        </button>
      </div>
    </Dialog>
  );
}

/** The first visit's tips, each pointing at what it explains. */
function Tour({ steps, onDone }: { steps: { target: RefObject<HTMLElement | null>; title: string; text: string }[]; onDone(): void }) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [bubbleHeight, setBubbleHeight] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  useModal(root);
  useLayoutEffect(() => {
    // Bring what the step explains into view (on a phone the cards start a screen down), then follow it.
    steps[step].target.current?.scrollIntoView({ block: "center", behavior: reducedMotion() ? "auto" : "smooth" });
    const measure = () => setRect(steps[step].target.current?.getBoundingClientRect() ?? null);
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step, steps]);
  useLayoutEffect(() => setBubbleHeight(bubble.current?.offsetHeight ?? 0));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onDone();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);
  if (!rect) return <div className="tour" ref={root} />;
  const s = steps[step];
  // Below the target if it's in the top half, above if not; always whole on screen, even if that
  // means covering part of a tall target.
  const width = Math.min(320, window.innerWidth - 32);
  const below = rect.top + rect.height / 2 < window.innerHeight / 2;
  const wanted = below ? rect.bottom + 18 : rect.top - 18 - bubbleHeight;
  const top = Math.min(Math.max(16, wanted), window.innerHeight - bubbleHeight - 16);
  return (
    <div className="tour" ref={root} role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <div className="tour-spot" style={{ left: rect.left - 8, top: rect.top - 8, width: rect.width + 16, height: rect.height + 16 }} />
      <div className="tour-bubble" ref={bubble} style={{ left: Math.min(Math.max(16, rect.left), window.innerWidth - width - 16), top, width }}>
        <span className="tour-step">
          {step + 1} of {steps.length}
        </span>
        <h2 id="tour-title">{s.title}</h2>
        <p>{s.text}</p>
        <div className="tour-buttons">
          <button type="button" className="link" onClick={onDone}>
            Skip
          </button>
          <button type="button" className="go" autoFocus onClick={() => (step + 1 < steps.length ? setStep(step + 1) : onDone())}>
            {step + 1 < steps.length ? "Next" : "Let's go"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** The History room (docs/time-machine.md): a century of crashes, and a film for each. */
export function HistoryRoom() {
  const [file, setFile] = useState<HistoryFile | null>(null);
  /** In today's dollars (adjusted for inflation), or in dollars of the time. */
  const [real, setReal] = useState(() => {
    try {
      return localStorage.getItem(REAL_KEY) === "on";
    } catch {
      return false;
    }
  });
  /** The film stops twice for you to sell, hold or buy more; off, it plays straight through. */
  const [decide, setDecide] = useState(() => {
    try {
      return localStorage.getItem(DECIDE_KEY) === "on";
    } catch {
      return false;
    }
  });
  const [failed, setFailed] = useState(false);
  const [stake, setStake] = useState(initialStake);
  const [film, setFilm] = useState<number | null>(null);
  /** The crash whose info popup is open. */
  const [info, setInfo] = useState<number | null>(null);
  const [results, setResults] = useState<Results>(loadResults);
  const [tour, setTour] = useState(() => {
    try {
      return localStorage.getItem(TOUR_KEY) !== "done";
    } catch {
      return false;
    }
  });
  const view = useRef<LongViewHandle>(null);
  const chartArea = useRef<HTMLDivElement>(null);
  const cardsRow = useRef<HTMLDivElement>(null);
  const stakeRef = useRef<HTMLDivElement>(null);
  const decideRef = useRef<HTMLLabelElement>(null);

  // A century of data, about 40 kB: only fetched when the room is opened.
  useEffect(() => {
    import("../../market/history/us-market.json")
      .then((m) => setFile(m.default as HistoryFile))
      .catch(() => setFailed(true));
  }, []);

  const nominal = useMemo(() => (file ? decodeHistory(file) : null), [file]);
  const days = useMemo(() => (file && nominal && real ? inTodaysDollars(nominal, file) : nominal), [file, nominal, real]);
  const crashes = useMemo(() => (days ? findCrashes(days) : []), [days]);
  const stories = useMemo(() => (days ? matchStories(crashes.map((c) => ({ peak: days[c.peak].time, bottom: days[c.bottom].time }))) : new Map()), [crashes, days]);

  const toggleReal = () => {
    const next = !real;
    setReal(next);
    try {
      localStorage.setItem(REAL_KEY, next ? "on" : "off");
    } catch {
      // Storage blocked: it lasts until the tab closes.
    }
  };

  const toggleDecide = () => {
    const next = !decide;
    setDecide(next);
    try {
      localStorage.setItem(DECIDE_KEY, next ? "on" : "off");
    } catch {
      // Storage blocked: it lasts until the tab closes.
    }
  };

  const changeStake = (n: number) => {
    setStake(n);
    try {
      localStorage.setItem(STAKE_KEY, String(n));
    } catch {
      // Storage blocked: it lasts until the tab closes.
    }
  };

  /** A crash's key in the saved results: its peak's date, and the money's mode. */
  const keyOf = (index: number) => (days ? `${dayString(days[crashes[index].peak].time)}${real ? ":real" : ""}` : "");
  const record = (index: number, result: FilmResult) => {
    // From what's saved now, not this tab's copy: another tab may have saved a result since.
    const next = keepBest(loadResults(), keyOf(index), result);
    setResults(next);
    saveResults(next);
  };

  /** A dive or a film is under way: another pick (a second click, the chart) waits for it to end. */
  const busy = useRef(false);
  const pick = async (index: number) => {
    if (busy.current) return;
    busy.current = true;
    try {
      await view.current?.dive(crashes[index]);
    } finally {
      setFilm(index);
    }
  };
  const closeFilm = async () => {
    setFilm(null);
    try {
      await view.current?.surface();
    } finally {
      busy.current = false;
    }
  };
  const endTour = () => {
    setTour(false);
    try {
      localStorage.setItem(TOUR_KEY, "done");
    } catch {
      // Storage blocked: the tour may show again.
    }
  };

  const first = days?.[0];
  const last = days?.[days.length - 1];
  // The hero doesn't need the data (only its growth sentence does), so it's the same while the data
  // loads: nothing moves when it arrives.
  const hero = (
    <section className="history-hero">
      <div>
        <h1>A century of crashes</h1>
        <p className="lead">
          The US stock market from 1926 to today. Every <span className="red-word">red stretch</span> is a crash.
          Tap one to live through it.
        </p>
        {!first || !last ? (
          <p className="growth">Loading a hundred years…</p>
        ) : real ? (
          <p className="growth">
            Counting inflation, $1 in {new Date(first.time * 1000).getUTCFullYear()} was worth about {dollars(Math.round(first.value))} of today's money. It grew to{" "}
            <strong>{dollars(Math.round(last.value))}</strong>: {Math.round(last.value / first.value).toLocaleString("en-US")} times the buying power.
          </p>
        ) : (
          <p className="growth">
            $1 in {new Date(first.time * 1000).getUTCFullYear()} became <strong>{dollars(Math.round(last.value))}</strong> by {mediumDate(last.time)}, dividends
            reinvested.
          </p>
        )}
        <div className="switches">
          <label className="switch">
            <input type="checkbox" checked={real} onChange={toggleReal} />
            <span className="switch-track" aria-hidden="true" />
            Adjust for inflation <span className="muted">(today's dollars)</span>
          </label>
          <label className="switch" ref={decideRef}>
            <input type="checkbox" checked={decide} onChange={toggleDecide} />
            <span className="switch-track" aria-hidden="true" />
            Stop to decide <span className="muted">(sell, hold or buy)</span>
          </label>
        </div>
      </div>
      <StakeChip stake={stake} onChange={changeStake} chipRef={stakeRef} />
    </section>
  );

  if (failed) return <main className="history"><p className="empty">Couldn't load the history. Try reloading the page.</p></main>;
  if (!days || !first || !last)
    return (
      <main className="history">
        {hero}
        <section className="panel history-chart" aria-busy="true">
          <div className="long-chart" />
          <p className="history-note muted">&nbsp;</p>
        </section>
      </main>
    );

  const famous = [...stories.entries()].sort((a, b) => crashes[a[0]].peak - crashes[b[0]].peak);
  const earned = badges(results, famous.map(([i]) => keyOf(i)));
  const others = crashes.map((_, i) => i).filter((i) => !stories.has(i));

  return (
    <main className="history">
      {hero}

      <section className="panel history-chart" ref={chartArea} aria-label="A century of the US stock market">
        <LongView ref={view} days={days} crashes={crashes} stories={stories} onPick={pick} />
        <p className="history-note muted">
          The whole US stock market, daily, dividends reinvested, on a log scale{real ? ", in today's dollars" : ""}. It tracks the S&amp;P 500 closely. Data:{" "}
          <a href="https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/data_library.html">Kenneth R. French Data Library</a> (CRSP)
          {real ? ", and the US consumer price index (BLS)" : ""}.
        </p>
      </section>

      <section className="crash-cards" ref={cardsRow} aria-label="Famous crashes">
        {famous.map(([i, s]) => {
          const c = crashes[i];
          return (
            <div key={i} className="crash-card-wrap">
              <button type="button" className="crash-card" onClick={() => pick(i)}>
                <span className="crash-emoji" aria-hidden="true">
                  {s.emoji}
                </span>
                <span className="crash-year">{new Date(days[c.peak].time * 1000).getUTCFullYear()}</span>
                <strong>{s.name}</strong>
                <span className="crash-drop">−{Math.round(c.drop * 100)}%</span>
                <span className="muted small">{span(days[c.peak].time, days[c.bottom].time, c.bottom - c.peak)} down</span>
                {results[keyOf(i)] ? (
                  <span className="crash-best">
                    Best: {results[keyOf(i)].emoji} {dollars(Math.round(results[keyOf(i)].you))}
                  </span>
                ) : (
                  <span className="crash-play">▶ Play</span>
                )}
              </button>
              <button type="button" className="crash-info" aria-label={`About ${s.name}`} title={`About ${s.name}`} onClick={() => setInfo(i)}>
                i
              </button>
            </div>
          );
        })}
      </section>

      {others.length > 0 && (
        <section className="other-crashes" aria-label="Every other crash">
          <h2>Every other crash</h2>
          <div className="other-list">
            {others.map((i) => {
              const c = crashes[i];
              const result = results[keyOf(i)];
              return (
                <button key={i} type="button" className="other-crash" onClick={() => pick(i)}>
                  <strong>{new Date(days[c.peak].time * 1000).getUTCFullYear()}</strong>
                  <span className="down">−{Math.round(c.drop * 100)}%</span>
                  <span className="muted small">{result ? `Best: ${result.emoji} ${dollars(Math.round(result.you))}` : `${span(days[c.peak].time, days[c.bottom].time, c.bottom - c.peak)} down`}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section className="badges" aria-label="Badges">
        <h2>
          Badges <span className="muted">{earned.filter((b) => b.earned).length} of {earned.length}</span>
        </h2>
        <ul>
          {earned.map((b) => (
            <li key={b.id} className={b.earned ? "earned" : ""} title={b.how}>
              <span className="badge-emoji" aria-hidden="true">
                {b.emoji}
              </span>
              <strong>{b.name}</strong>
              <span className="muted small">{b.earned ? "Earned" : b.how}</span>
            </li>
          ))}
        </ul>
      </section>

      <WhatIf days={days} stake={stake} real={real} />

      {info !== null && stories.has(info) && (
        <CrashInfo
          story={stories.get(info)!}
          facts={`From the high on ${mediumDate(days[crashes[info].peak].time)}: −${Math.round(crashes[info].drop * 100)}% in ${span(days[crashes[info].peak].time, days[crashes[info].bottom].time, crashes[info].bottom - crashes[info].peak)}${real ? ", in today's dollars" : ""}.`}
          onClose={() => setInfo(null)}
          onPlay={() => {
            setInfo(null);
            void pick(info);
          }}
        />
      )}

      {film !== null && crashes[film] && (
        <CrashFilm
          // A new film for each crash and mode: nothing carries over from the last one.
          key={keyOf(film)}
          days={days}
          crash={crashes[film]}
          story={stories.get(film)}
          amount={stake}
          reserve={stake * RESERVE}
          real={real}
          decide={decide}
          onResult={(r) => record(film, r)}
          onClose={closeFilm}
        />
      )}

      {tour && film === null && (
        <Tour
          onDone={endTour}
          steps={[
            { target: chartArea, title: "100 years of the stock market", text: "Every day since 1926, on one chart. Drag to move through time, scroll or pinch to zoom." },
            { target: cardsRow, title: "Red means a crash", text: "Each red stretch is a fall of 20% or more. Tap one, here or on the chart, to live through it as a film." },
            { target: stakeRef, title: "Choose your stake", text: "You start each crash with this much in the market, plus a quarter of it in cash." },
            {
              target: decideRef,
              title: "Watch, or play",
              text: "Films play straight through. Turn on “Stop to decide” and each one pauses twice to ask: sell, hold or buy more? Then see how you did against just holding.",
            },
          ]}
        />
      )}
    </main>
  );
}
