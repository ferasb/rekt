import { useEffect, useRef, type ReactNode } from "react";
import { money, signedMoney } from "../game/format";
import { canBailout } from "../game/game";
import { TITLES, titleFor } from "../game/titles";
import { resetGame, takeBailout, useEquity, useGame } from "./engine";

/** A native <dialog>, open while mounted: focus, Escape and the backdrop come for free. */
function Dialog({ title, onClose, children }: { title: string; onClose(): void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    return () => d.close();
  }, []);
  return (
    <dialog ref={ref} className="dialog" aria-labelledby="dialog-title" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      <h2 id="dialog-title">{title}</h2>
      {children}
    </dialog>
  );
}

export function StatsDialog({ onClose }: { onClose(): void }) {
  const s = useGame((g) => g.game.stats);
  const startedAt = useGame((g) => g.game.startedAt);
  const value = useEquity();
  const title = titleFor(value);
  const next = TITLES.find((t) => t.from > value);
  const rows: [string, ReactNode][] = [
    ["Equity", money(value)],
    ["All-time high", money(s.allTimeHigh)],
    ["Rank", `${title.emoji} ${title.name}`],
    ["Next rank", next ? `${next.emoji} ${next.name} at ${money(next.from)}` : "There's nothing above you. 👑"],
    ["Trades", `${s.trades} (${s.wins} won, ${s.losses} lost)`],
    ["Liquidations 💀", s.liquidations],
    ["Best trade", s.trades ? signedMoney(s.bestTrade) : "—"],
    ["Worst trade", s.trades ? signedMoney(s.worstTrade) : "—"],
    ["Up or Down rounds", `${s.roundsWon} won, ${s.roundsLost} lost, ${s.roundsPushed} pushed`],
    ["Best streak 🔥", s.bestStreak],
    ["Bailouts 🪂", s.bailouts],
    ["Playing since", new Date(startedAt).toLocaleDateString(undefined, { dateStyle: "medium" })],
  ];
  return (
    <Dialog title="📊 Your stats" onClose={onClose}>
      <dl className="stats">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <button type="button" className="go" onClick={onClose}>
        Back to the casino
      </button>
    </Dialog>
  );
}

export function ResetDialog({ onClose }: { onClose(): void }) {
  return (
    <Dialog title="🧨 Reset everything?" onClose={onClose}>
      <p>This wipes your money, positions, history, stats and bailout count, and starts over with $10,000. It can't be undone.</p>
      <div className="dialog-actions">
        <button type="button" className="chip" onClick={onClose}>
          Keep playing
        </button>
        <button
          type="button"
          className="go danger"
          onClick={() => {
            resetGame();
            onClose();
          }}
        >
          Wipe it all
        </button>
      </div>
    </Dialog>
  );
}

/** When you're broke with nothing open: the bailout (design.md §3). */
export function Bailout() {
  const broke = useGame((g) => canBailout(g.game));
  const bailouts = useGame((g) => g.game.stats.bailouts);
  if (!broke) return null;
  return (
    <div className="bailout" role="region" aria-label="Bailout">
      <p>
        <strong>You're broke. 💸</strong> {bailouts > 0 ? `Again. (${bailouts} bailout${bailouts > 1 ? "s" : ""} so far.)` : "It happens to the best of us."}
      </p>
      <button type="button" className="go" onClick={takeBailout}>
        🪂 Get bailed out ($10,000)
      </button>
    </div>
  );
}
