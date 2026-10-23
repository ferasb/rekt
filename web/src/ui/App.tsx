import { useEffect, useState } from "react";
import { assetById, blurbOf } from "../market/assets";
import { CandleChart } from "./charts/CandleChart";
import { Bailout, ResetDialog, StatsDialog } from "./Dialogs";
import { watchAssets } from "./engine";
import { Effects } from "./fx/Effects";
import { MarketHours } from "./MarketHours";
import { Markets } from "./Markets";
import { OrderTicket } from "./OrderTicket";
import { Positions } from "./Positions";
import { loadAsset, saveAsset, useRoom } from "./rooms";
import { TopBar } from "./TopBar";
import { UpDown } from "./UpDown";
import { HistoryRoom } from "./history/HistoryRoom";
import { ErrorBoundary } from "./ErrorBoundary";
import { usePrices } from "./prices";
import { Pnl } from "./widgets";
import { price as fmtPrice } from "../game/format";

/** Candle sizes both exchanges serve, in seconds. */
const CHART_SIZES = [
  { g: 60, label: "1m" },
  { g: 300, label: "5m" },
  { g: 3600, label: "1h" },
];

function ChartHeader({ asset, granularity, onGranularity }: { asset: string; granularity: number; onGranularity(g: number): void }) {
  const a = assetById(asset);
  const price = usePrices((s) => s.prices[asset]);
  const open = usePrices((s) => s.open24h[asset]);
  return (
    <div className="chart-head">
      <div>
        <h2>
          {a.name} <span className="muted">{a.symbol}/USD</span>
        </h2>
        <p className="muted blurb">{blurbOf(a)}</p>
        {a.kind === "stock" && <MarketHours />}
      </div>
      <div className="chart-price">
        <strong className="num">{price ? fmtPrice(price) : "…"}</strong>
        {/* Always two lines, so the header keeps its size when the first price arrives. */}
        <span>
          {price && open ? <Pnl fraction={price / open - 1} /> : <span className="muted">—</span>} <span className="muted">24h</span>
        </span>
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
  const room = useRoom();
  const [asset, setAsset] = useState(loadAsset);
  const [granularity, setGranularity] = useState(60);
  const [dialog, setDialog] = useState<"stats" | "reset" | null>(null);
  const pick = (id: string) => {
    setAsset(id);
    saveAsset(id);
  };
  // The picked one always has live prices, featured or not.
  useEffect(() => watchAssets("selected", [asset]), [asset]);

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
      ) : room === "updown" ? (
        <UpDown asset={asset} onPick={pick} />
      ) : (
        <ErrorBoundary label="History">
          <HistoryRoom />
        </ErrorBoundary>
      )}
      <footer className="footer">
        Play money, real prices (crypto from Coinbase, stocks from Kraken). Not financial advice; not even good advice.
        <br />
        Your game is saved only in this browser: no accounts, no tracking, no cookies from this site. · <a href="about.html">About</a> ·{" "}
        <a href="privacy.html">Privacy</a> · by <a href="https://ferasbisharat.com">Feras Bisharat</a> · also:{" "}
        <a href="https://bloch-sphere.ferasbisharat.com">Bloch Sphere</a>
      </footer>
      {dialog === "stats" && <StatsDialog onClose={() => setDialog(null)} />}
      {dialog === "reset" && <ResetDialog onClose={() => setDialog(null)} />}
      <Effects />
    </div>
  );
}
