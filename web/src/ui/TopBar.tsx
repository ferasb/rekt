import { useState } from "react";
import { money } from "../game/format";
import { STARTING_CASH } from "../game/game";
import { titleFor } from "../game/titles";
import { useEquity, useGame } from "./engine";
import { useSound } from "./fx/sound";
import { usePrices } from "./prices";
import type { Room } from "./rooms";
import { useTheme } from "./theme";
import { Pnl, useCountUp, useFlash } from "./widgets";

const STATUS = {
  connecting: { label: "Connecting…", hint: "Connecting for live prices." },
  live: { label: "Live", hint: "Live prices: crypto from Coinbase, stocks from Kraken." },
  offline: { label: "Reconnecting…", hint: "Lost the connection for live prices. Trying again; nothing happens to your positions until prices come back." },
};

/** Both exchanges as one light: the worse of the two (an idle one, with nothing to watch, doesn't count). */
function useFeedStatus(): keyof typeof STATUS {
  const { coinbase, kraken } = usePrices((s) => s.status);
  const active = [coinbase, kraken].filter((s) => s !== "idle");
  if (active.includes("offline")) return "offline";
  if (active.includes("connecting")) return "connecting";
  return "live";
}

export function TopBar({ room, onStats, onReset }: { room: Room; onStats(): void; onReset(): void }) {
  const value = useEquity();
  const shown = useCountUp(value);
  const flash = useFlash(Math.round(value * 100));
  const title = titleFor(value);
  const bailouts = useGame((s) => s.game.stats.bailouts);
  const status = useFeedStatus();
  const theme = useTheme();
  const sound = useSound();
  const [menu, setMenu] = useState(false);

  return (
    <header className="topbar">
      <a className="logo" href="#trade" aria-label="rekt, home">
        rekt<span aria-hidden="true">.</span>
      </a>
      <nav className="rooms" aria-label="Game">
        <a href="#trade" aria-current={room === "trade" ? "page" : undefined}>
          Trade
        </a>
        <a href="#updown" aria-current={room === "updown" ? "page" : undefined}>
          Up or Down
        </a>
      </nav>
      <div className="wallet" aria-live="off">
        <div className={`equity ${flash}`} title="Equity: your cash plus everything open">
          {money(shown)}
        </div>
        <div className="wallet-sub">
          <Pnl fraction={value / STARTING_CASH - 1} />
          <span className="rank" title="Your rank, by equity">
            {title.emoji} {title.name}
          </span>
          {bailouts > 0 && (
            <span className="shame" title="Times you were bailed out">
              🪂×{bailouts}
            </span>
          )}
        </div>
      </div>
      <div className="tools">
        <span className={`feed ${status}`} title={STATUS[status].hint} role="status">
          <span className="dot" aria-hidden="true" />
          {STATUS[status].label}
        </span>
        <button type="button" className="icon" onClick={sound.toggle} aria-pressed={sound.on} title={sound.on ? "Mute sounds" : "Turn sounds on"}>
          <span aria-hidden="true">{sound.on ? "🔊" : "🔇"}</span>
          <span className="sr-only">Sound</span>
        </button>
        <button
          type="button"
          className="icon"
          onClick={theme.toggle}
          title={theme.theme === "dark" ? "Switch to light" : "Switch to dark"}
          aria-label={theme.theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        >
          <span aria-hidden="true">{theme.theme === "dark" ? "☀️" : "🌙"}</span>
        </button>
        <div className="menu-wrap">
          <button type="button" className="icon" aria-expanded={menu} aria-haspopup="menu" onClick={() => setMenu(!menu)} title="Menu">
            <span aria-hidden="true">☰</span>
            <span className="sr-only">Menu</span>
          </button>
          {menu && (
            <div className="menu" role="menu" onClick={() => setMenu(false)}>
              <button type="button" role="menuitem" onClick={onStats}>
                📊 Stats
              </button>
              <a role="menuitem" href="about.html">
                ℹ️ About
              </a>
              <a role="menuitem" href="privacy.html">
                🔒 Privacy
              </a>
              <button type="button" role="menuitem" className="danger" onClick={onReset}>
                🧨 Reset everything
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
