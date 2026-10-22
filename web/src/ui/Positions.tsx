import { useState } from "react";
import { ago, amount, price as fmtPrice } from "../game/format";
import type { Trade } from "../game/game";
import { closePayout, liquidationPrice, pnl, realized, safety, type Position } from "../game/money";
import { assetById } from "../market/assets";
import { closeAll, closeTrade, useGame } from "./engine";
import { toast } from "./fx/bus";
import { usePrices } from "./prices";
import { Pnl, useFlash } from "./widgets";

const symbol = (asset: string) => assetById(asset)?.symbol ?? asset;

function PositionRow({ p, onPick }: { p: Position; onPick(asset: string): void }) {
  const price = usePrices((s) => s.prices[p.asset]);
  // What closing now would make, after both fees: the same number the toast and history will show.
  const value = price ? realized(p, closePayout(p, price)) : 0;
  const flash = useFlash(price ? Math.round(pnl(p, price) * 100) : undefined);
  const s = price ? safety(p, price) : 1;
  const danger = s < 0.25 ? "critical" : s < 0.5 ? "warning" : "";

  const onClose = () => {
    try {
      closeTrade(p.id);
    } catch (e) {
      toast("danger", "Can't close yet", (e as Error).message);
    }
  };

  return (
    <li className={`position ${danger}`}>
      <button type="button" className="position-name link" onClick={() => onPick(p.asset)} title="Show on the chart">
        <span className={`side-tag ${p.side}`}>{p.side === "long" ? "▲ LONG" : "▼ SHORT"}</span> <strong>{symbol(p.asset)}</strong> {p.leverage}×
      </button>
      <div className={`position-pnl ${flash}`}>
        {price ? (
          <>
            <Pnl value={value} /> <Pnl fraction={value / p.margin} />
          </>
        ) : (
          "…"
        )}
      </div>
      <dl className="position-facts">
        <div>
          <dt>Size</dt>
          <dd>
            {amount(p.size)} {symbol(p.asset)}
          </dd>
        </div>
        <div>
          <dt>Entry</dt>
          <dd>{fmtPrice(p.entryPrice)}</dd>
        </div>
        <div>
          <dt>Now</dt>
          <dd>{price ? fmtPrice(price) : "…"}</dd>
        </div>
        <div>
          <dt>💀 Liq.</dt>
          <dd>{fmtPrice(liquidationPrice(p))}</dd>
        </div>
      </dl>
      <div className="safety" title={`${Math.round(s * 100)}% of the way from liquidation`}>
        <div className="safety-fill" style={{ width: `${s * 100}%` }} />
        <span className="sr-only">{Math.round(s * 100)}% of the way from liquidation</span>
      </div>
      <button type="button" className="close-btn" onClick={onClose} disabled={!price}>
        Close
      </button>
    </li>
  );
}

function HistoryRow({ t }: { t: Trade }) {
  return (
    <li className="history-row">
      <span>
        {t.how === "liquidated" ? "💀" : t.result > 0 ? "✅" : "❌"} <span className={`side-tag ${t.side}`}>{t.side === "long" ? "▲" : "▼"}</span>{" "}
        {symbol(t.asset)} {t.leverage}×
      </span>
      <span className="muted">
        {fmtPrice(t.entryPrice)} → {fmtPrice(t.exitPrice)}
      </span>
      <Pnl value={t.result} />
      <span className="muted">
        {t.how === "liquidated" ? (t.away ? "rekt while away" : "rekt") : "closed"} · {ago(Date.now() - t.closedAt)}
      </span>
    </li>
  );
}

/** Your open positions, live, and the recent history (design.md §2.1). */
export function Positions({ onPick }: { onPick(asset: string): void }) {
  const positions = useGame((s) => s.game.positions);
  const history = useGame((s) => s.game.history);
  const [tab, setTab] = useState<"open" | "history">("open");

  return (
    <section className="panel positions" aria-label="Positions">
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "open"} onClick={() => setTab("open")}>
          Open ({positions.length})
        </button>
        <button type="button" role="tab" aria-selected={tab === "history"} onClick={() => setTab("history")}>
          History ({history.length})
        </button>
        {tab === "open" && positions.length > 1 && (
          <button type="button" className="chip close-all" onClick={closeAll}>
            Close all
          </button>
        )}
      </div>
      {tab === "open" ? (
        positions.length === 0 ? (
          <p className="empty">No open positions. Pick a direction, crank the leverage, and see what happens. 🎲</p>
        ) : (
          <ul className="position-list">
            {[...positions].reverse().map((p) => (
              <PositionRow key={p.id} p={p} onPick={onPick} />
            ))}
          </ul>
        )
      ) : history.length === 0 ? (
        <p className="empty">Nothing closed yet. History is written by the brave.</p>
      ) : (
        <ul className="history">
          {history.map((t) => (
            <HistoryRow key={t.id} t={t} />
          ))}
        </ul>
      )}
    </section>
  );
}
