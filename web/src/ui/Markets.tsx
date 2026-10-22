import { price as fmtPrice } from "../game/format";
import { ASSETS, type Asset } from "../market/assets";
import { useGame } from "./engine";
import { usePrices } from "./prices";
import { Pnl, useFlash } from "./widgets";

function Row({ asset, selected, onPick, open }: { asset: Asset; selected: boolean; onPick(): void; open: number }) {
  const price = usePrices((s) => s.prices[asset.id]);
  const open24 = usePrices((s) => s.open24h[asset.id]);
  const flash = useFlash(price);
  return (
    <li>
      <button type="button" className={`market ${selected ? "selected" : ""}`} aria-pressed={selected} onClick={onPick} title={asset.blurb}>
        <span className="market-name">
          <strong>{asset.symbol}</strong>
          <span className="muted">{asset.name}</span>
        </span>
        <span className="market-price">
          <span className={`num ${flash}`}>{price ? fmtPrice(price) : "…"}</span>
          {price && open24 ? <Pnl fraction={price / open24 - 1} /> : <span className="muted">—</span>}
        </span>
        {open > 0 && (
          <span className="badge" title={`${open} open position${open > 1 ? "s" : ""}`}>
            {open}
          </span>
        )}
      </button>
    </li>
  );
}

/** The coins, with live prices and the day's change (design.md §2.1). */
export function Markets({ asset, onPick }: { asset: string; onPick(id: string): void }) {
  const positions = useGame((s) => s.game.positions);
  return (
    <section className="panel markets" aria-label="Markets">
      <h2>Markets</h2>
      <ul>
        {ASSETS.map((a) => (
          <Row key={a.id} asset={a} selected={a.id === asset} onPick={() => onPick(a.id)} open={positions.filter((p) => p.asset === a.id).length} />
        ))}
      </ul>
    </section>
  );
}
