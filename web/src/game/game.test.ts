import { describe, expect, it } from "vitest";
import {
  BAILOUT_BELOW,
  STARTING_CASH,
  bailout,
  canBailout,
  checkLiquidations,
  close,
  closingPrice,
  equity,
  markRound,
  newGame,
  notePeak,
  open,
  roundOutcome,
  settleRound,
  startRound,
  voidRound,
  type Game,
} from "./game";
import { liquidationPrice, openCost, type OpenOrder } from "./money";

const order: OpenOrder = { asset: "BTC-USD", side: "long", margin: 1000, leverage: 10, price: 100 };

function opened(game: Game = newGame(0), o = order, id = "p1"): Game {
  return open(game, o, id, 1).game;
}

describe("trading", () => {
  it("opens a position from cash", () => {
    const { game, events } = open(newGame(0), order, "p1", 1);
    expect(game.cash).toBeCloseTo(STARTING_CASH - openCost(1000, 10));
    expect(game.positions).toHaveLength(1);
    expect(events[0].type).toBe("opened");
  });

  it("refuses an order cash can't pay for", () => {
    expect(() => open(newGame(0), { ...order, margin: 20_000 }, "p1", 1)).toThrow(/cash/i);
  });

  it("counts a position in equity at the live price", () => {
    const game = opened();
    expect(equity(game, { "BTC-USD": 100 })).toBeCloseTo(STARTING_CASH - 5);
    expect(equity(game, { "BTC-USD": 110 })).toBeCloseTo(STARTING_CASH - 5 + 1000);
    expect(equity(game, {})).toBeCloseTo(STARTING_CASH - 5);
  });

  it("closes a winner into cash and the stats", () => {
    const { game, events } = close(opened(), "p1", 110, 2);
    expect(game.positions).toHaveLength(0);
    expect(game.history[0].how).toBe("closed");
    expect(game.history[0].result).toBeGreaterThan(980);
    expect(game.stats).toMatchObject({ trades: 1, wins: 1, losses: 0, liquidations: 0 });
    expect(game.stats.bestTrade).toBe(game.history[0].result);
    expect(game.stats.worstTrade).toBe(game.history[0].result);
    expect(events[0].type).toBe("closed");
  });

  it("treats closing past the liquidation price as a liquidation", () => {
    const { game, events } = close(opened(), "p1", 80, 2);
    expect(events[0].type).toBe("liquidated");
    expect(game.history[0].result).toBeCloseTo(-1005);
  });

  it("ignores an unknown position", () => {
    const game = opened();
    expect(close(game, "nope", 110, 2)).toEqual({ game, events: [] });
  });
});

describe("liquidations", () => {
  it("liquidate positions the price crosses, and only those", () => {
    let game = opened();
    game = opened(game, { ...order, side: "short" }, "p2");
    game = opened(game, { ...order, asset: "ETH-USD" }, "p3");
    const liq = liquidationPrice(game.positions[0]);
    const { game: after, events } = checkLiquidations(game, "BTC-USD", liq - 0.01, 5);
    expect(events.map((e) => e.type)).toEqual(["liquidated"]);
    expect(after.positions.map((p) => p.id)).toEqual(["p2", "p3"]);
    expect(after.stats.liquidations).toBe(1);
    expect(after.history[0].exitPrice).toBeCloseTo(liq);
  });

  it("liquidate several at once", () => {
    let game = opened();
    game = opened(game, { ...order, leverage: 50 }, "p2");
    const { game: after, events } = checkLiquidations(game, "BTC-USD", 50, 5);
    expect(events).toHaveLength(2);
    expect(after.positions).toHaveLength(0);
    expect(after.stats.liquidations).toBe(2);
  });

  it("leave safe positions alone", () => {
    const game = opened();
    expect(checkLiquidations(game, "BTC-USD", 95, 5).events).toHaveLength(0);
  });
});

describe("Up or Down", () => {
  const start = (game = newGame(0), call: "up" | "down" = "up") =>
    startRound(game, { asset: "BTC-USD", call, stake: 100, duration: 60_000, price: 100 }, "r1", 1000).game;

  it("takes the stake from cash, and counts it in equity", () => {
    const game = start();
    expect(game.cash).toBe(STARTING_CASH - 100);
    expect(equity(game, {})).toBe(STARTING_CASH);
    expect(game.round?.endsAt).toBe(61_000);
  });

  it("allows one round at a time", () => {
    expect(() => start(start())).toThrow(/already/i);
  });

  it("decides the outcome", () => {
    expect(roundOutcome("up", 100, 101)).toBe("win");
    expect(roundOutcome("up", 100, 99)).toBe("loss");
    expect(roundOutcome("down", 100, 99)).toBe("win");
    expect(roundOutcome("down", 100, 101)).toBe("loss");
    expect(roundOutcome("down", 100, 100)).toBe("push");
  });

  it("doubles a win and builds a streak", () => {
    let game = settleRound(start(), 101, 61_000).game;
    expect(game.cash).toBe(STARTING_CASH + 100);
    expect(game.stats).toMatchObject({ roundsWon: 1, streak: 1, bestStreak: 1 });
    game = settleRound(start(game), 102, 61_000).game;
    expect(game.stats.streak).toBe(2);
    game = settleRound(start(game), 99, 61_000).game;
    expect(game.stats).toMatchObject({ streak: 0, bestStreak: 2, roundsLost: 1 });
    expect(game.cash).toBe(STARTING_CASH + 100);
  });

  it("refunds a push or a void round, leaving the streak alone", () => {
    let game = settleRound(start(), 101, 61_000).game;
    game = settleRound(start(game), 100, 61_000).game;
    expect(game.cash).toBe(STARTING_CASH + 100);
    expect(game.stats).toMatchObject({ roundsPushed: 1, streak: 1 });
    const voided = voidRound(start(game), 99_000);
    expect(voided.game.cash).toBe(STARTING_CASH + 100);
    expect(voided.game.rounds[0]).toMatchObject({ outcome: "void", endPrice: null });
    expect(voided.game.stats.streak).toBe(1);
  });
});

describe("going broke", () => {
  it("bails out only when broke with nothing open", () => {
    const broke: Game = { ...newGame(0), cash: BAILOUT_BELOW - 1 };
    expect(canBailout(newGame(0))).toBe(false);
    expect(canBailout(broke)).toBe(true);
    const { game } = bailout(broke, 5);
    expect(game.cash).toBe(STARTING_CASH);
    expect(game.stats.bailouts).toBe(1);
    expect(bailout(newGame(0), 5).events).toHaveLength(0);
  });

  it("records new highs only", () => {
    const game = newGame(0);
    expect(notePeak(game, 5000)).toBe(game);
    expect(notePeak(game, 12_000).stats.allTimeHigh).toBe(12_000);
  });
});

describe("closing price of a round", () => {
  const round = startRound(newGame(0), { asset: "BTC-USD", call: "up", stake: 100, duration: 60_000, price: 100 }, "r1", 1000).game.round!;

  it("is the last price before the end, not one that came after", () => {
    let mark = markRound(null, round, "BTC-USD", 101, 30_000);
    mark = markRound(mark, round, "BTC-USD", 102, 61_000); // the end: still counts
    mark = markRound(mark, round, "BTC-USD", 95, 61_001); // after the end: ignored
    expect(closingPrice(round, mark)).toBe(102);
  });

  it("ignores other assets and a round that's over", () => {
    expect(markRound(null, round, "ETH-USD", 5, 2000)).toBeNull();
    expect(markRound(null, null, "BTC-USD", 5, 2000)).toBeNull();
  });

  it("is the start price when nothing traded", () => {
    expect(closingPrice(round, null)).toBe(100);
  });

  it("doesn't carry over from an earlier round", () => {
    const other = { ...round, id: "r2" };
    expect(closingPrice(other, markRound(null, round, "BTC-USD", 120, 2000))).toBe(100);
  });
});
