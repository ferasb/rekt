import { create } from "zustand";
import { findLiquidation } from "../game/away";
import { money, price as fmtPrice, signedMoney } from "../game/format";
import {
  bailout,
  checkLiquidations,
  close,
  closingPrice,
  equity,
  liquidate,
  markRound,
  newGame,
  notePeak,
  open,
  settleRound,
  startRound,
  voidRound,
  type Call,
  type Game,
  type GameEvent,
  type RoundMark,
  type Step,
  type Trade,
} from "../game/game";
import { roe, safety, type OpenOrder } from "../game/money";
import { BAILOUT, BIG_WIN, LIQUIDATED, LOSS, ROUND_LOSS, ROUND_WIN, SMALL_WIN, pick } from "../game/roasts";
import { titleFor } from "../game/titles";
import { FEATURED, assetById, sourceOf, type Source } from "../market/assets";
import { granularityFor } from "../market/candles";
import { CANDLE_LIMITS, connectFeed, fetchCandles, type Feed, type Tick } from "../market/feeds";
import { loadCovered, loadGame, onGameSavedElsewhere, saveCovered, saveGame } from "../persist/game";
import { fx, reducedMotion, toast } from "./fx/bus";
import { play } from "./fx/sound";
import { latest, receiveTick, setFeedStatus, usePrices } from "./prices";

/**
 * The game, live: the one place that changes it. Every change goes through a pure action in
 * game/game.ts, is saved, and its events become reactions (design.md §8).
 */
interface GameState {
  game: Game;
}

/** A round that ended more than this long ago when the page opened was left behind (design.md §5). */
const LEFT_THE_TABLE_MS = 3000;

function initialGame(): Game {
  const game = loadGame() ?? newGame(Date.now());
  // A round that ended while the page was closed: void, stake back (the toast comes after the first render).
  if (game.round && game.round.endsAt < Date.now() - LEFT_THE_TABLE_MS) {
    setTimeout(() => toast("info", "You left the table", "Your Up or Down round ended while the page was closed, so it's void and your stake is back."), 500);
    return voidRound(game, Date.now()).game;
  }
  return game;
}

export const useGame = create<GameState>(() => ({ game: initialGame() }));

saveGame(useGame.getState().game);

function commit(step: Step): void {
  if (step.events.length === 0 && step.game === useGame.getState().game) return;
  const before = useGame.getState().game;
  useGame.setState({ game: step.game });
  saveGame(step.game);
  react(before, step.game, step.events);
}

const id = () => crypto.randomUUID();

// Actions, for the UI. Each throws (with a message for the visitor) when the game refuses.

export function openTrade(order: Omit<OpenOrder, "price">): void {
  commit(open(useGame.getState().game, { ...order, price: latest[order.asset] ?? NaN }, id(), Date.now()));
}

export function closeTrade(positionId: string): void {
  const position = useGame.getState().game.positions.find((p) => p.id === positionId);
  const price = position && latest[position.asset];
  if (!price) throw new Error("No price yet");
  commit(close(useGame.getState().game, positionId, price, Date.now()));
}

export function closeAll(): void {
  for (const p of useGame.getState().game.positions) {
    if (latest[p.asset]) closeTrade(p.id);
  }
}

export function playRound(asset: string, call: Call, stake: number, duration: number): void {
  commit(startRound(useGame.getState().game, { asset, call, stake, duration, price: latest[asset] }, id(), Date.now()));
}

export function takeBailout(): void {
  commit(bailout(useGame.getState().game, Date.now()));
}

export function resetGame(): void {
  useGame.setState({ game: newGame(Date.now()) });
  saveGame(useGame.getState().game);
  warned.clear();
  toast("info", "Fresh start", "Everything's wiped. $10,000, a clean record, no bailouts.");
}

// Reactions

function describe(t: Pick<Trade, "asset" | "side" | "leverage">): string {
  return `${t.leverage}× ${t.side} on ${assetById(t.asset).symbol}`;
}

function react(before: Game, after: Game, events: GameEvent[]): void {
  const liquidations = events.flatMap((e) => (e.type === "liquidated" ? [e.trade] : []));
  for (const e of events) {
    switch (e.type) {
      case "opened":
        play("open");
        break;
      case "closed": {
        const t = e.trade;
        const big = t.result >= 1000 || t.result / t.margin >= 0.5;
        if (t.result > 0) {
          play(big ? "bigwin" : "win");
          fx({ type: "confetti", amount: big ? "lots" : "some" });
          toast("win", `${signedMoney(t.result)} ${pick(big ? BIG_WIN : SMALL_WIN)}`, `Closed your ${describe(t)}.`);
        } else {
          play("loss");
          toast("loss", `${signedMoney(t.result)} ${pick(LOSS)}`, `Closed your ${describe(t)}.`);
        }
        break;
      }
      case "round-ended": {
        const r = e.result;
        const symbol = assetById(r.asset).symbol;
        if (r.outcome === "win") {
          play("win");
          fx({ type: "confetti", amount: e.streak >= 3 ? "lots" : "some" });
          const streak = e.streak >= 2 ? ` 🔥×${e.streak}` : "";
          toast("win", `+${money(r.stake)} ${pick(ROUND_WIN)}${streak}`, `${symbol} went ${r.call}: ${fmtPrice(r.startPrice)} → ${fmtPrice(r.endPrice!)}.`);
        } else if (r.outcome === "loss") {
          play("loss");
          toast("loss", `−${money(r.stake)} ${pick(ROUND_LOSS)}`, `${symbol} went ${r.call === "up" ? "down" : "up"}: ${fmtPrice(r.startPrice)} → ${fmtPrice(r.endPrice!)}.`);
        } else if (r.outcome === "push") {
          play("close");
          toast("info", "Push: not a cent moved", `${symbol} ended exactly where it started. Your stake is back.`);
        } else {
          toast("info", "Round void", "The prices stopped coming, so nobody wins. Your stake is back.");
        }
        break;
      }
      case "bailout":
        play("bailout");
        fx({ type: "confetti", amount: "some" });
        toast("info", pick(BAILOUT), `Bailouts so far: ${after.stats.bailouts}.`);
        break;
    }
  }
  if (liquidations.length > 0) {
    play("rekt");
    if (!reducedMotion()) fx({ type: "shake" });
    const lost = -liquidations.reduce((sum, t) => sum + t.result, 0);
    const away = liquidations.some((t) => t.away);
    const what =
      liquidations.length === 1
        ? `Your ${describe(liquidations[0])} was liquidated at ${fmtPrice(liquidations[0].exitPrice)}.`
        : `${liquidations.length} positions were liquidated.`;
    const when = away
      ? `While you were gone (${new Date(Math.min(...liquidations.map((t) => t.closedAt))).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}): `
      : "";
    fx({ type: "rekt", headline: "REKT", detail: `${when}${what} You lost ${money(lost)}.`, roast: pick(LIQUIDATED) });
  }
  // A new rank, after money actually changed hands.
  if (events.some((e) => e.type !== "opened" && e.type !== "round-started")) {
    const was = titleFor(equity(before, latest));
    const now = titleFor(equity(after, latest));
    if (was.name !== now.name) {
      const up = now.from > was.from;
      setTimeout(() => toast(up ? "win" : "loss", `${up ? "Promoted" : "Demoted"}: ${now.emoji} ${now.name}`, up ? "Your rank went up." : "Your rank went down."), 1200);
    }
  }
}

// Danger: a warning when a position gets close to liquidation, once until it recovers.
const warned = new Set<string>();
const WARN_BELOW = 0.25;
const RECOVER_ABOVE = 0.5;

function checkDanger(asset: string, price: number): void {
  for (const p of useGame.getState().game.positions) {
    if (p.asset !== asset) continue;
    const s = safety(p, price);
    if (s < WARN_BELOW && !warned.has(p.id)) {
      warned.add(p.id);
      play("warning");
      toast("danger", "Close to liquidation 😬", `Your ${describe(p)} is ${Math.round(s * 100)}% of the way from liquidation (${signedMoney(roe(p, price) * p.margin)}).`);
    } else if (s > RECOVER_ABOVE) {
      warned.delete(p.id);
    }
  }
}

// The live feeds: Coinbase for crypto, Kraken for stocks.

const SOURCES: readonly Source[] = ["coinbase", "kraken"];
const feeds: Partial<Record<Source, Feed>> = {};
const live: Record<Source, boolean> = { coinbase: false, kraken: false };
/** While catching up on a gap, that exchange's coveredUntil stays put. */
const catchingUp: Record<Source, boolean> = { coinbase: false, kraken: false };

/**
 * What needs live prices, by who asked: the panels register what they show (the markets list, search
 * results, the chart), and the game adds its open positions and round, which are always watched.
 */
const watching = new Map<string, readonly string[]>();

function rewatch(): void {
  const game = useGame.getState().game;
  const ids = new Set<string>([...game.positions.map((p) => p.asset), ...(game.round ? [game.round.asset] : [])]);
  for (const list of watching.values()) for (const id of list) ids.add(id);
  for (const source of SOURCES) feeds[source]?.watch([...ids].filter((id) => sourceOf(id) === source));
}

let rewatchTimer: ReturnType<typeof setTimeout> | undefined;

/** Asks for live prices of these assets, under a key (a later call with the key replaces them). */
export function watchAssets(key: string, ids: readonly string[]): void {
  watching.set(key, ids);
  // Batched: typing in search changes the list on every key.
  clearTimeout(rewatchTimer);
  rewatchTimer = setTimeout(rewatch, 150);
}

export function unwatchAssets(key: string): void {
  watchAssets(key, []);
  watching.delete(key);
}

/** The running round's closing price so far (game.ts markRound). */
let roundMark: RoundMark | null = null;

function handleTick(tick: Tick): void {
  receiveTick(tick);
  const game = useGame.getState().game;
  roundMark = markRound(roundMark, game.round, tick.asset, tick.price, Date.now());
  if (game.positions.some((p) => p.asset === tick.asset)) {
    commit(checkLiquidations(game, tick.asset, tick.price, Date.now()));
    checkDanger(tick.asset, tick.price);
  }
}

/**
 * Checks an exchange's candles for liquidations its live feed didn't see: while the page was closed,
 * or the connection was down (design.md §5).
 */
async function catchUp(source: Source): Promise<void> {
  if (catchingUp[source]) return;
  const from = loadCovered(source);
  const now = Date.now();
  const positions = useGame.getState().game.positions.filter((p) => sourceOf(p.asset) === source);
  if (!from || now - from < 10_000 || positions.length === 0) {
    saveCovered(source, now);
    return;
  }
  catchingUp[source] = true;
  try {
    const { sizes, max } = CANDLE_LIMITS[source];
    const granularity = granularityFor(now - from, sizes, max);
    const assets = [...new Set(positions.map((p) => p.asset))];
    const candles = await Promise.all(assets.map((a) => fetchCandles(a, granularity, { start: from, end: now })));
    const byAsset = new Map(assets.map((a, i) => [a, candles[i]]));
    let step: Step = { game: useGame.getState().game, events: [] };
    for (const p of step.game.positions) {
      if (!byAsset.has(p.asset)) continue;
      const at = findLiquidation(p, byAsset.get(p.asset)!, from);
      if (at !== null) {
        const next = liquidate(step.game, p.id, at, now - at > 60_000);
        step = { game: next.game, events: [...step.events, ...next.events] };
      }
    }
    commit(step);
    saveCovered(source, now);
  } catch {
    // The exchange is unreachable: try again soon, still from the same moment.
    setTimeout(() => void catchUp(source), 30_000);
  } finally {
    catchingUp[source] = false;
  }
}

/** Every few seconds: note what the feeds have covered, and record a new high. */
let lastBeat = Date.now();
function heartbeat(): void {
  const now = Date.now();
  // A long pause means the computer slept or the tab was frozen: the feeds may have missed prices.
  const slept = now - lastBeat > 15_000;
  for (const source of SOURCES) {
    if (slept) void catchUp(source);
    else if (live[source] && !catchingUp[source]) saveCovered(source, now);
  }
  lastBeat = now;
  const game = useGame.getState().game;
  const value = equity(game, latest);
  if (value > game.stats.allTimeHigh) {
    useGame.setState({ game: notePeak(game, value) });
    saveGame(useGame.getState().game);
  }
}

function checkRound(): void {
  const round = useGame.getState().game.round;
  if (!round || Date.now() < round.endsAt) return;
  // At the price when the clock ran out, however late this timer fires (a background tab slows it).
  const game = useGame.getState().game;
  const now = Date.now();
  commit(live[sourceOf(round.asset)] ? settleRound(game, closingPrice(round, roundMark), now) : voidRound(game, now));
}

/** Starts the live feeds and the game's clocks. Call once. */
export function startEngine(): void {
  for (const source of SOURCES) {
    feeds[source] = connectFeed(source, {
      onTick: handleTick,
      onStatus(status) {
        const wasLive = live[source];
        live[source] = status === "live";
        setFeedStatus(source, status);
        if (live[source] && !wasLive) void catchUp(source);
      },
    });
  }
  // The featured coins and stocks are always on the markets list.
  watchAssets("featured", FEATURED.map((a) => a.id));
  // A new position or round is watched (and a closed one dropped) as soon as it changes.
  let watchedGame = useGame.getState().game;
  useGame.subscribe(({ game }) => {
    if (game.positions !== watchedGame.positions || game.round !== watchedGame.round) rewatch();
    watchedGame = game;
  });
  setInterval(heartbeat, 5000);
  setInterval(checkRound, 200);
  onGameSavedElsewhere((game) => {
    if (game) useGame.setState({ game });
  });
}

/** Equity at the latest drawn prices, for components. */
export function useEquity(): number {
  const game = useGame((s) => s.game);
  const prices = usePrices((s) => s.prices);
  return equity(game, prices);
}
