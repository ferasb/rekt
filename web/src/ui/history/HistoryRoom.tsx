import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { storyFor, type CrashStory } from "../../game/crashes";
import { money } from "../../game/format";
import { decodeHistory, findCrashes, type Day, type HistoryFile } from "../../game/history";
import { hashParam } from "../rooms";
import { CrashFilm } from "./CrashFilm";
import { LongView, type LongViewHandle } from "./LongView";
import { dayString, mediumDate, span } from "./time";

// The stake: from the address (#history?amount=250000), else the visitor's last pick, else $1,000,000.
const STAKE_KEY = "rekt:stake";
const TOUR_KEY = "rekt:history-tour";
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
        Starting with <strong>{money(stake).replace(/\.00$/, "")}</strong> <span aria-hidden="true">▾</span>
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
                {money(p).replace(/\.00$/, "")}
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
          <p className="muted small">Plus {money(stake * RESERVE).replace(/\.00$/, "")} in cash, for buying the dip.</p>
        </div>
      )}
    </div>
  );
}

/** The first visit's three tips, each pointing at what it explains. */
function Tour({ steps, onDone }: { steps: { target: RefObject<HTMLElement | null>; title: string; text: string }[]; onDone(): void }) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    const measure = () => setRect(steps[step].target.current?.getBoundingClientRect() ?? null);
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step, steps]);
  if (!rect) return null;
  const s = steps[step];
  const below = rect.top < window.innerHeight / 2;
  return (
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <div className="tour-spot" style={{ left: rect.left - 8, top: rect.top - 8, width: rect.width + 16, height: rect.height + 16 }} />
      <div
        className="tour-bubble"
        style={{
          left: Math.min(Math.max(16, rect.left), window.innerWidth - 336),
          top: below ? rect.bottom + 18 : undefined,
          bottom: below ? undefined : window.innerHeight - rect.top + 18,
        }}
      >
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
  const [days, setDays] = useState<Day[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [stake, setStake] = useState(initialStake);
  const [film, setFilm] = useState<number | null>(null);
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

  // A century of data, about 40 kB: only fetched when the room is opened.
  useEffect(() => {
    import("../../market/history/us-market.json")
      .then((m) => setDays(decodeHistory(m.default as HistoryFile)))
      .catch(() => setFailed(true));
  }, []);

  const crashes = useMemo(() => (days ? findCrashes(days) : []), [days]);
  const stories = useMemo(() => {
    const map = new Map<number, CrashStory>();
    crashes.forEach((c, i) => {
      const s = days && storyFor(dayString(days[c.peak].time));
      if (s) map.set(i, s);
    });
    return map;
  }, [crashes, days]);

  const changeStake = (n: number) => {
    setStake(n);
    try {
      localStorage.setItem(STAKE_KEY, String(n));
    } catch {
      // Storage blocked: it lasts until the tab closes.
    }
  };

  const pick = async (index: number) => {
    await view.current?.dive(crashes[index]);
    setFilm(index);
  };
  const closeFilm = async () => {
    setFilm(null);
    await view.current?.surface();
  };
  const endTour = () => {
    setTour(false);
    try {
      localStorage.setItem(TOUR_KEY, "done");
    } catch {
      // Storage blocked: the tour may show again.
    }
  };

  if (failed) return <main className="history"><p className="empty">Couldn't load the history. Try reloading the page.</p></main>;
  if (!days) return <main className="history"><p className="empty">Loading a hundred years…</p></main>;

  const first = days[0];
  const last = days[days.length - 1];
  const famous = [...stories.entries()].sort((a, b) => crashes[a[0]].peak - crashes[b[0]].peak);

  return (
    <main className="history">
      <section className="history-hero">
        <div>
          <h1>A century of crashes</h1>
          <p className="lead">
            The US stock market from {new Date(first.time * 1000).getUTCFullYear()} to today. Every <span className="red-word">red stretch</span> is a crash.
            Tap one to live through it.
          </p>
          <p className="growth">
            $1 in {new Date(first.time * 1000).getUTCFullYear()} became <strong>{money(last.value).replace(/\.\d\d$/, "")}</strong> by{" "}
            {mediumDate(last.time)}, dividends reinvested.
          </p>
        </div>
        <StakeChip stake={stake} onChange={changeStake} chipRef={stakeRef} />
      </section>

      <section className="panel history-chart" ref={chartArea} aria-label="A century of the US stock market">
        <LongView ref={view} days={days} crashes={crashes} stories={stories} onPick={pick} />
        <p className="history-note muted">
          The whole US stock market, daily, dividends reinvested, on a log scale. It tracks the S&amp;P 500 closely. Data:{" "}
          <a href="https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/data_library.html">Kenneth R. French Data Library</a> (CRSP).
        </p>
      </section>

      <section className="crash-cards" ref={cardsRow} aria-label="Famous crashes">
        {famous.map(([i, s]) => {
          const c = crashes[i];
          return (
            <button key={i} type="button" className="crash-card" onClick={() => pick(i)}>
              <span className="crash-emoji" aria-hidden="true">
                {s.emoji}
              </span>
              <span className="crash-year">{new Date(days[c.peak].time * 1000).getUTCFullYear()}</span>
              <strong>{s.name}</strong>
              <span className="crash-drop">−{Math.round(c.drop * 100)}%</span>
              <span className="muted small">{span(days[c.peak].time, days[c.bottom].time, c.bottom - c.peak)} down</span>
              <span className="crash-play">▶ Play</span>
            </button>
          );
        })}
      </section>

      {film !== null && (
        <CrashFilm days={days} crash={crashes[film]} story={stories.get(film)} amount={stake} reserve={stake * RESERVE} onClose={closeFilm} />
      )}

      {tour && film === null && (
        <Tour
          onDone={endTour}
          steps={[
            { target: chartArea, title: "100 years of the stock market", text: "Every day since 1926, on one chart. Drag to move through time, scroll or pinch to zoom." },
            { target: cardsRow, title: "Red means a crash", text: "Each red stretch is a fall of 20% or more. Tap one, here or on the chart, to live through it as a film." },
            { target: stakeRef, title: "Choose your stake", text: "You start each crash with this much in the market, plus a quarter of it in cash. Then you decide: sell, hold or buy more?" },
          ]}
        />
      )}
    </main>
  );
}
