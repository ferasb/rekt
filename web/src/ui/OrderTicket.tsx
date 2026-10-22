import { useState } from "react";
import { amount, money, price as fmtPrice } from "../game/format";
import { FEE_RATE, liquidationPrice, maxMargin, orderProblem, type Side } from "../game/money";
import { LEVERAGE_STEPS } from "../game/titles";
import { assetById } from "../market/assets";
import { openTrade, useGame } from "./engine";
import { toast } from "./fx/bus";
import { usePrices } from "./prices";
import { MoneyInput } from "./widgets";

/** Long or short, margin and leverage, and what that means before you click (design.md §2.1). */
export function OrderTicket({ asset }: { asset: string }) {
  const cash = useGame((s) => s.game.cash);
  const price = usePrices((s) => s.prices[asset]);
  const [side, setSide] = useState<Side>("long");
  const [marginText, setMarginText] = useState("1000.00");
  const [step, setStep] = useState(4); // 10×
  const leverage = LEVERAGE_STEPS[step].leverage;
  const margin = Number(marginText) || 0;
  const symbol = assetById(asset).symbol;

  const order = { asset, side, margin, leverage, price: price ?? NaN };
  const problem = orderProblem(order, cash);
  const notional = margin * leverage;
  const liq = price ? liquidationPrice({ side, leverage, entryPrice: price }) : null;
  const max = maxMargin(cash, leverage);

  const submit = () => {
    try {
      openTrade({ asset, side, margin, leverage });
    } catch (e) {
      toast("danger", "Can't open that", (e as Error).message);
    }
  };

  return (
    <section className="panel ticket" aria-label="New position">
      <h2>New position: {symbol}</h2>
      <div className="side-toggle" role="radiogroup" aria-label="Direction">
        <button type="button" role="radio" aria-checked={side === "long"} className={`side long ${side === "long" ? "on" : ""}`} onClick={() => setSide("long")}>
          ▲ Long
          <small>price goes up</small>
        </button>
        <button type="button" role="radio" aria-checked={side === "short"} className={`side short ${side === "short" ? "on" : ""}`} onClick={() => setSide("short")}>
          ▼ Short
          <small>price goes down</small>
        </button>
      </div>

      <MoneyInput
        id="margin"
        label={`Margin (cash: ${money(cash)})`}
        value={marginText}
        onChange={setMarginText}
        presets={[
          { label: "10%", value: max * 0.1 },
          { label: "25%", value: max * 0.25 },
          { label: "50%", value: max * 0.5 },
          { label: "Max", value: max },
        ]}
      />

      <div className="field">
        <label htmlFor="leverage">
          Leverage: <strong className="lev">{leverage}×</strong> <span className="muted">{LEVERAGE_STEPS[step].nickname}</span>
        </label>
        <input
          id="leverage"
          type="range"
          min={0}
          max={LEVERAGE_STEPS.length - 1}
          step={1}
          value={step}
          onChange={(e) => setStep(Number(e.target.value))}
          aria-valuetext={`${leverage}×, ${LEVERAGE_STEPS[step].nickname}`}
          className={`lev-${step >= 6 ? "hot" : step >= 4 ? "warm" : "cool"}`}
        />
        <div className="ticks" aria-hidden="true">
          {LEVERAGE_STEPS.map((s) => (
            <span key={s.leverage}>{s.leverage}×</span>
          ))}
        </div>
      </div>

      <dl className="preview">
        <div>
          <dt>Position size</dt>
          <dd>
            {money(notional)} {price ? <span className="muted">≈ {amount(notional / price)} {symbol}</span> : null}
          </dd>
        </div>
        <div>
          <dt>Entry (market)</dt>
          <dd>{price ? fmtPrice(price) : "…"}</dd>
        </div>
        <div>
          <dt>Fee (0.05%)</dt>
          <dd>{money(notional * FEE_RATE)}</dd>
        </div>
        <div>
          <dt>💀 Liquidation</dt>
          <dd>
            {liq && price ? (
              <>
                {fmtPrice(liq)}{" "}
                <span className="muted">
                  ({side === "long" ? "−" : "+"}
                  {(Math.abs(liq / price - 1) * 100).toFixed(2)}%)
                </span>
              </>
            ) : (
              "…"
            )}
          </dd>
        </div>
      </dl>

      <button type="button" className={`go ${side}`} disabled={problem !== null} onClick={submit}>
        {problem ?? `${side === "long" ? "▲ Long" : "▼ Short"} ${symbol} ${leverage}×`}
      </button>
      {leverage >= 50 && !problem && <p className="hint">A {(100 / leverage - 0.5).toFixed(1)}% move against you and it's gone. Good luck. 🫡</p>}
    </section>
  );
}
