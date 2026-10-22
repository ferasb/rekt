// The whole game (design.md §2–§5): cash, positions, the running round, history and stats. Pure:
// every action takes a Game and returns a new one, plus the events the UI reacts to.

import {
  MIN_MARGIN,
  closePayout,
  isLiquidated,
  liquidationPrice,
  openCost,
  openPosition,
  orderProblem,
  positionValue,
  realized,
  type OpenOrder,
  type Position,
  type Side,
} from "./money";

export const STARTING_CASH = 10_000;
/** Below this much equity, with nothing open, the game offers a bailout. */
export const BAILOUT_BELOW = 10;
/** How many closed trades and finished rounds the history keeps. */
export const HISTORY_LIMIT = 50;

export type Call = "up" | "down";

export interface Trade {
  id: string;
  asset: string;
  side: Side;
  leverage: number;
  margin: number;
  entryPrice: number;
  exitPrice: number;
  openedAt: number;
  closedAt: number;
  /** After all fees: positive is a win. */
  result: number;
  how: "closed" | "liquidated";
  /** Liquidated while the page was closed (design.md §5). */
  away?: boolean;
}

export interface Round {
  id: string;
  asset: string;
  call: Call;
  stake: number;
  startPrice: number;
  startedAt: number;
  endsAt: number;
}

export type RoundOutcome = "win" | "loss" | "push" | "void";

export interface RoundResult {
  id: string;
  asset: string;
  call: Call;
  stake: number;
  startPrice: number;
  /** Null for a void round: it never saw its end. */
  endPrice: number | null;
  outcome: RoundOutcome;
  /** What came back to cash: 2× stake for a win, the stake for a push or void, 0 for a loss. */
  payout: number;
  endedAt: number;
}

export interface Stats {
  trades: number;
  wins: number;
  losses: number;
  liquidations: number;
  bestTrade: number;
  worstTrade: number;
  allTimeHigh: number;
  roundsWon: number;
  roundsLost: number;
  roundsPushed: number;
  /** Rounds won in a row, now. */
  streak: number;
  bestStreak: number;
  bailouts: number;
}

export interface Game {
  version: 1;
  cash: number;
  positions: Position[];
  /** Closed trades, newest first. */
  history: Trade[];
  round: Round | null;
  /** Finished rounds, newest first. */
  rounds: RoundResult[];
  stats: Stats;
  startedAt: number;
}

export type GameEvent =
  | { type: "opened"; position: Position }
  | { type: "closed"; trade: Trade }
  | { type: "liquidated"; trade: Trade }
  | { type: "round-started"; round: Round }
  | { type: "round-ended"; result: RoundResult; streak: number }
  | { type: "bailout" };

export interface Step {
  game: Game;
  events: GameEvent[];
}

export function newGame(now: number, bailouts = 0): Game {
  return {
    version: 1,
    cash: STARTING_CASH,
    positions: [],
    history: [],
    round: null,
    rounds: [],
    stats: {
      trades: 0,
      wins: 0,
      losses: 0,
      liquidations: 0,
      bestTrade: 0,
      worstTrade: 0,
      allTimeHigh: STARTING_CASH,
      roundsWon: 0,
      roundsLost: 0,
      roundsPushed: 0,
      streak: 0,
      bestStreak: 0,
      bailouts,
    },
    startedAt: now,
  };
}

/** Cash plus everything open, at these prices. A position without a price counts at its margin. */
export function equity(game: Game, prices: Readonly<Record<string, number>>): number {
  let total = game.cash + (game.round?.stake ?? 0);
  for (const p of game.positions) total += positionValue(p, prices[p.asset]);
  return total;
}

/** Records a new all-time high, if this equity is one. */
export function notePeak(game: Game, value: number): Game {
  return value > game.stats.allTimeHigh ? { ...game, stats: { ...game.stats, allTimeHigh: value } } : game;
}

// Trades

export function open(game: Game, order: OpenOrder, id: string, now: number): Step {
  const problem = orderProblem(order, game.cash);
  if (problem) throw new Error(problem);
  const position = openPosition(order, id, now);
  // Never below zero: the cent of slack in orderProblem.
  const cash = Math.max(0, game.cash - openCost(order.margin, order.leverage));
  return { game: { ...game, cash, positions: [...game.positions, position] }, events: [{ type: "opened", position }] };
}

function settle(game: Game, position: Position, payout: number, exitPrice: number, now: number, how: Trade["how"], away: boolean): Step {
  const result = realized(position, payout);
  const trade: Trade = {
    id: position.id,
    asset: position.asset,
    side: position.side,
    leverage: position.leverage,
    margin: position.margin,
    entryPrice: position.entryPrice,
    exitPrice,
    openedAt: position.openedAt,
    closedAt: now,
    result,
    how,
    ...(away ? { away } : {}),
  };
  const s = game.stats;
  const first = s.trades === 0;
  const stats: Stats = {
    ...s,
    trades: s.trades + 1,
    wins: s.wins + (result > 0 ? 1 : 0),
    losses: s.losses + (result > 0 ? 0 : 1),
    liquidations: s.liquidations + (how === "liquidated" ? 1 : 0),
    bestTrade: first ? result : Math.max(s.bestTrade, result),
    worstTrade: first ? result : Math.min(s.worstTrade, result),
  };
  return {
    game: {
      ...game,
      cash: game.cash + payout,
      positions: game.positions.filter((p) => p.id !== position.id),
      history: [trade, ...game.history].slice(0, HISTORY_LIMIT),
      stats,
    },
    events: [{ type: how === "closed" ? "closed" : "liquidated", trade }],
  };
}

export function close(game: Game, positionId: string, price: number, now: number): Step {
  const position = game.positions.find((p) => p.id === positionId);
  if (!position) return { game, events: [] };
  // Closing past the liquidation price is a liquidation: the margin is already gone.
  if (isLiquidated(position, price)) return liquidate(game, positionId, now, false);
  return settle(game, position, closePayout(position, price), price, now, "closed", false);
}

/** Liquidates a position at its liquidation price: the margin is lost. */
export function liquidate(game: Game, positionId: string, now: number, away: boolean): Step {
  const position = game.positions.find((p) => p.id === positionId);
  if (!position) return { game, events: [] };
  return settle(game, position, 0, liquidationPrice(position), now, "liquidated", away);
}

/** Liquidates every position on this asset that this price has crossed. Runs on every tick. */
export function checkLiquidations(game: Game, asset: string, price: number, now: number): Step {
  let step: Step = { game, events: [] };
  for (const position of game.positions) {
    if (position.asset === asset && isLiquidated(position, price)) {
      const next = liquidate(step.game, position.id, now, false);
      step = { game: next.game, events: [...step.events, ...next.events] };
    }
  }
  return step;
}

// Up or Down (design.md §2.2)

export const ROUND_DURATIONS = [30_000, 60_000, 300_000] as const;

export function roundProblem(game: Game, stake: number, price: number | undefined): string | null {
  if (game.round) return "A round is already running";
  if (!(price !== undefined && price > 0)) return "No price yet";
  if (!(stake >= MIN_MARGIN)) return `At least $${MIN_MARGIN}`;
  if (stake > game.cash + 0.005) return "Not enough cash";
  return null;
}

export function startRound(
  game: Game,
  round: { asset: string; call: Call; stake: number; duration: number; price: number | undefined },
  id: string,
  now: number,
): Step {
  const problem = roundProblem(game, round.stake, round.price);
  if (problem) throw new Error(problem);
  const started: Round = {
    id,
    asset: round.asset,
    call: round.call,
    stake: Math.min(round.stake, game.cash),
    startPrice: round.price!,
    startedAt: now,
    endsAt: now + round.duration,
  };
  return {
    game: { ...game, cash: game.cash - started.stake, round: started },
    events: [{ type: "round-started", round: started }],
  };
}

export function roundOutcome(call: Call, startPrice: number, endPrice: number): Exclude<RoundOutcome, "void"> {
  if (endPrice === startPrice) return "push";
  return (endPrice > startPrice) === (call === "up") ? "win" : "loss";
}

function finishRound(game: Game, outcome: RoundOutcome, endPrice: number | null, now: number): Step {
  const round = game.round;
  if (!round) return { game, events: [] };
  const payout = outcome === "win" ? 2 * round.stake : outcome === "loss" ? 0 : round.stake;
  const result: RoundResult = {
    id: round.id,
    asset: round.asset,
    call: round.call,
    stake: round.stake,
    startPrice: round.startPrice,
    endPrice,
    outcome,
    payout,
    endedAt: now,
  };
  const s = game.stats;
  // A push or a void round leaves the streak alone.
  const streak = outcome === "win" ? s.streak + 1 : outcome === "loss" ? 0 : s.streak;
  const stats: Stats = {
    ...s,
    roundsWon: s.roundsWon + (outcome === "win" ? 1 : 0),
    roundsLost: s.roundsLost + (outcome === "loss" ? 1 : 0),
    roundsPushed: s.roundsPushed + (outcome === "push" ? 1 : 0),
    streak,
    bestStreak: Math.max(s.bestStreak, streak),
  };
  return {
    game: { ...game, cash: game.cash + payout, round: null, rounds: [result, ...game.rounds].slice(0, HISTORY_LIMIT), stats },
    events: [{ type: "round-ended", result, streak }],
  };
}

/** Ends the running round at this price. */
export function settleRound(game: Game, endPrice: number, now: number): Step {
  if (!game.round) return { game, events: [] };
  return finishRound(game, roundOutcome(game.round.call, game.round.startPrice, endPrice), endPrice, now);
}

/** Ends the running round without a result (it ended while the page was closed): the stake comes back. */
export function voidRound(game: Game, now: number): Step {
  return finishRound(game, "void", null, now);
}

// Going broke

export function canBailout(game: Game): boolean {
  return game.positions.length === 0 && game.round === null && game.cash < BAILOUT_BELOW;
}

/** A fresh $10,000, keeping the count of bailouts. */
export function bailout(game: Game, now: number): Step {
  if (!canBailout(game)) return { game, events: [] };
  return { game: newGame(now, game.stats.bailouts + 1), events: [{ type: "bailout" }] };
}
