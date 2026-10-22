import { describe, expect, it } from "vitest";
import { close, newGame, open, settleRound, startRound } from "../game/game";
import { parseGame } from "./game";

function played() {
  let game = newGame(0);
  game = open(game, { asset: "BTC-USD", side: "long", margin: 100, leverage: 5, price: 100 }, "a", 1).game;
  game = open(game, { asset: "ETH-USD", side: "short", margin: 100, leverage: 5, price: 100 }, "b", 1).game;
  game = close(game, "a", 110, 2).game;
  game = settleRound(startRound(game, { asset: "SOL-USD", call: "up", stake: 10, duration: 30_000, price: 5 }, "r", 3).game, 6, 4).game;
  game = startRound(game, { asset: "SOL-USD", call: "down", stake: 10, duration: 30_000, price: 5 }, "r2", 5).game;
  return game;
}

describe("saved games", () => {
  it("round-trip through JSON", () => {
    const game = played();
    expect(parseGame(JSON.parse(JSON.stringify(game)))).toEqual(game);
    expect(parseGame(JSON.parse(JSON.stringify(newGame(0))))).toEqual(newGame(0));
  });

  it("are refused when corrupt or from another version", () => {
    const game = played();
    expect(parseGame(null)).toBeNull();
    expect(parseGame({ ...game, version: 2 })).toBeNull();
    expect(parseGame({ ...game, cash: -1 })).toBeNull();
    expect(parseGame({ ...game, cash: "lots" })).toBeNull();
    expect(parseGame({ ...game, positions: [{ ...game.positions[0], asset: "BTC-EUR" }] })).toBeNull();
    expect(parseGame({ ...game, positions: [{ ...game.positions[0], leverage: 1000 }] })).toBeNull();
    expect(parseGame({ ...game, stats: { ...game.stats, wins: null } })).toBeNull();
    expect(parseGame({ ...game, round: { nope: 1 } })).toBeNull();
  });
});
