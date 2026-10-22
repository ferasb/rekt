import { useState } from "react";
import { GRANULARITIES, type Granularity } from "../market/candles";
import { assetById } from "../market/assets";
import { CandleChart } from "./charts/CandleChart";
import { Bailout, ResetDialog, StatsDialog } from "./Dialogs";
import { Effects } from "./fx/Effects";
import { Markets } from "./Markets";
import { OrderTicket } from "./OrderTicket";
import { Positions } from "./Positions";
import { loadAsset, saveAsset, useRoom } from "./rooms";
import { TopBar } from "./TopBar";
import { UpDown } from "./UpDown";
import { usePrices } from "./prices";
import { Pnl } from "./widgets";
import { price as fmtPrice } from "../game/format";

const CHART_SIZES: { g: Granularity; label: string }[] = [
  { g: GRANULARITIES[0], label: "1m" },
  { g: GRANULARITIES[1], label: "5m" },
  { g: GRANULARITIES[3], label: "1h" },
];

function ChartHeader({ asset, granularity, onGranularity }: { asset: string; granularity: Granularity; onGranularity(g: Granularity): void }) {
  const a = assetById(asset)!;
  const price = usePrices((s) => s.prices[asset]);
  const open = usePrices((s) => s.open24h[asset]);
  return (
    <div className="chart-head">
      <div>
        <h2>
          {a.name} <span className="muted">{a.symbol}/USD</span>
        </h2>
        <p className="muted blurb">{a.blurb}</p>
      </div>
      <div className="chart-price">
        <strong className="num">{price ? fmtPrice(price) : "…"}</strong>
        {price && open ? (
          <span>
            <Pnl fraction={price / open - 1} /> <span className="muted">24h</span>
          </span>
        ) : null}
      </div>
      <div className="presets" role="radiogroup" aria-label="Candle size">
        {CHART_SIZES.map((s) => (
          <button key={s.g} type="button" role="radio" aria-checked={s.g === granularity} className="chip" onClick={() => onGranularity(s.g)}>
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function App() {
  const { room } = useRoom();
  const [asset, setAsset] = useState(loadAsset);
  const [granularity, setGranularity] = useState<Granularity>(60);
  const [dialog, setDialog] = useState<"stats" | "reset" | null>(null);
  const pick = (id: string) => {
    setAsset(id);
    saveAsset(id);
  };

  return (
    <div className="app">
      <TopBar room={room} onStats={() => setDialog("stats")} onReset={() => setDialog("reset")} />
      <Bailout />
      {room === "trade" ? (
        <main className="desk">
          <Markets asset={asset} onPick={pick} />
          <div className="center">
            <section className="panel chart-panel" aria-label="Chart">
              <ChartHeader asset={asset} granularity={granularity} onGranularity={setGranularity} />
              <CandleChart asset={asset} granularity={granularity} />
            </section>
            <Positions onPick={pick} />
          </div>
          <OrderTicket asset={asset} />
        </main>
      ) : (
        <UpDown asset={asset} onPick={pick} />
      )}
      <footer className="footer">
        Play money, real prices (from Coinbase). Not financial advice; not even good advice. ·{" "}
        <a href="about.html">About</a> · <a href="privacy.html">Privacy</a> · by <a href="https://ferasbisharat.com">Feras Bisharat</a>
      </footer>
      {dialog === "stats" && <StatsDialog onClose={() => setDialog(null)} />}
      {dialog === "reset" && <ResetDialog onClose={() => setDialog(null)} />}
      <Effects />
    </div>
  );
}
