import { useEffect, useState } from "react";
import { countdown, money, price as fmtPrice } from "../game/format";
import { ROUND_DURATIONS, roundOutcome, roundProblem, type Call } from "../game/game";
import { ASSETS, assetById } from "../market/assets";
import { RoundChart } from "./charts/RoundChart";
import { playRound, useGame } from "./engine";
import { toast } from "./fx/bus";
import { play } from "./fx/sound";
import { usePrices } from "./prices";
import { MoneyInput, Pnl } from "./widgets";

const DURATION_LABELS: Record<number, string> = { 30_000: "30 s", 60_000: "1 min", 300_000: "5 min" };

function useNow(active: boolean): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

/** The running round: countdown, start vs now, and who's winning. */
function Running() {
  const round = useGame((s) => s.game.round)!;
  const price = usePrices((s) => s.prices[round.asset]);
  const now = useNow(true);
  const left = round.endsAt - now;
  const total = round.endsAt - round.startedAt;
  const outcome = price ? roundOutcome(round.call, round.startPrice, price) : "push";
  const symbol = assetById(round.asset)?.symbol ?? round.asset;

  // A tick each second in the last five.
  const second = Math.ceil(left / 1000);
  useEffect(() => {
    if (second <= 5 && second > 0) play("tick");
  }, [second]);

  const ring = 2 * Math.PI * 52;
  return (
    <div className={`running ${outcome}`}>
      <div className="countdown" role="timer" aria-label={`${countdown(left)} left`}>
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle className="ring-track" cx="60" cy="60" r="52" />
          <circle className="ring-fill" cx="60" cy="60" r="52" strokeDasharray={ring} strokeDashoffset={ring * (1 - Math.max(0, left) / total)} />
        </svg>
        <span className={second <= 5 ? "final" : ""}>{countdown(left)}</span>
      </div>
      <div className="running-facts">
        <p className="call">
          You called <strong className={round.call}>{round.call === "up" ? "▲ UP" : "▼ DOWN"}</strong> on {symbol} for {money(round.stake)}
        </p>
        <p>
          Start <strong>{fmtPrice(round.startPrice)}</strong> · Now <strong>{price ? fmtPrice(price) : "…"}</strong>{" "}
          {price ? <Pnl fraction={price / round.startPrice - 1} /> : null}
        </p>
        <p className="verdict" aria-live="polite">
          {outcome === "win" ? "😎 Winning… for now" : outcome === "loss" ? "😰 Losing… come on!" : "😐 Dead even"}
        </p>
      </div>
    </div>
  );
}

/** Quick rounds: call the next 30 s, 1 min or 5 min (design.md §2.2). */
export function UpDown({ asset, onPick }: { asset: string; onPick(id: string): void }) {
  const game = useGame((s) => s.game);
  const price = usePrices((s) => s.prices[asset]);
  const [stakeText, setStakeText] = useState("100.00");
  const [duration, setDuration] = useState<number>(60_000);
  const stake = Number(stakeText) || 0;
  const problem = roundProblem(game, stake, price);
  const last = game.rounds[0];
  const symbol = assetById(asset)?.symbol ?? asset;

  const go = (call: Call, amount = stake) => {
    try {
      playRound(asset, call, amount, duration);
    } catch (e) {
      toast("danger", "Can't start that", (e as Error).message);
    }
  };

  // ↑ and ↓ call the round.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLDialogElement || problem) return;
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      e.preventDefault();
      go(e.key === "ArrowUp" ? "up" : "down");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const s = game.stats;
  const played = s.roundsWon + s.roundsLost;
  return (
    <main className="updown">
      <section className="panel updown-main" aria-label="Up or Down">
        <div className="updown-head">
          <div>
            <h2>Up or Down?</h2>
            <p className="muted">Call where {symbol} will be when the clock runs out. Right: double your stake. Wrong: it's gone.</p>
          </div>
          {s.streak > 0 && (
            <div className="streak" title="Rounds won in a row">
              🔥×{s.streak}
            </div>
          )}
        </div>
        <div className="coin-picker" role="radiogroup" aria-label="Coin">
          {ASSETS.map((a) => (
            <button key={a.id} type="button" role="radio" aria-checked={a.id === asset} className="chip" disabled={game.round !== null} onClick={() => onPick(a.id)}>
              {a.symbol}
            </button>
          ))}
        </div>
        <RoundChart asset={game.round?.asset ?? asset} round={game.round} />
        {game.round ? (
          <Running />
        ) : (
          <div className="bet">
            <MoneyInput
              id="stake"
              label={`Stake (cash: ${money(game.cash)})`}
              value={stakeText}
              onChange={setStakeText}
              presets={[
                { label: "$10", value: Math.min(10, game.cash) },
                { label: "$100", value: Math.min(100, game.cash) },
                { label: "$1,000", value: Math.min(1000, game.cash) },
                { label: "All in", value: game.cash },
              ]}
            />
            <div className="field">
              <span className="label" id="duration-label">
                Clock
              </span>
              <div className="presets" role="radiogroup" aria-labelledby="duration-label">
                {ROUND_DURATIONS.map((d) => (
                  <button key={d} type="button" role="radio" aria-checked={d === duration} className="chip" onClick={() => setDuration(d)}>
                    {DURATION_LABELS[d]}
                  </button>
                ))}
              </div>
            </div>
            <div className="calls">
              <button type="button" className="call-btn up" disabled={problem !== null} onClick={() => go("up")}>
                <span aria-hidden="true">🚀</span> UP
                <small>{price ? `above ${fmtPrice(price)}` : "…"}</small>
              </button>
              <button type="button" className="call-btn down" disabled={problem !== null} onClick={() => go("down")}>
                <span aria-hidden="true">🪂</span> DOWN
                <small>{price ? `below ${fmtPrice(price)}` : "…"}</small>
              </button>
            </div>
            {problem && problem !== "A round is already running" && <p className="hint">{problem}</p>}
            {last && last.outcome === "win" && last.payout <= game.cash && (
              <button type="button" className="chip ride" onClick={() => go(last.call, last.payout)}>
                🎰 Let it ride: {money(last.payout)} on {last.call.toUpperCase()} again
              </button>
            )}
            <p className="hint muted">Tip: press ↑ or ↓ to call.</p>
          </div>
        )}
      </section>
      <section className="panel rounds" aria-label="Recent rounds">
        <h2>Recent rounds</h2>
        <p className="muted">
          {played > 0 ? `${s.roundsWon} won, ${s.roundsLost} lost (${Math.round((100 * s.roundsWon) / played)}%)` : "No rounds yet."} · best streak {s.bestStreak}
        </p>
        <ul className="history">
          {game.rounds.slice(0, 15).map((r) => (
            <li key={r.id} className="history-row">
              <span>
                {r.outcome === "win" ? "✅" : r.outcome === "loss" ? "❌" : "➖"} {assetById(r.asset)?.symbol} <span className={r.call}>{r.call === "up" ? "▲ UP" : "▼ DOWN"}</span>
              </span>
              <span className="muted">
                {fmtPrice(r.startPrice)} → {r.endPrice ? fmtPrice(r.endPrice) : "void"}
              </span>
              <Pnl value={r.payout - r.stake} />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
