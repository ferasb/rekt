// The money math (design.md §4): isolated-margin perpetual futures, simplified. Pure.

export type Side = "long" | "short";

/** The taker fee, as a fraction of notional, paid on opening and on closing. */
export const FEE_RATE = 0.0005;
/** The maintenance margin, as a fraction of the entry notional. */
export const MAINTENANCE_RATE = 0.005;
/** The smallest margin a position (or stake a round) can have, in dollars. */
export const MIN_MARGIN = 1;
export const MAX_LEVERAGE = 100;

export interface Position {
  id: string;
  /** A Coinbase product id, e.g. "BTC-USD". */
  asset: string;
  side: Side;
  /** Dollars set aside for this position. */
  margin: number;
  leverage: number;
  entryPrice: number;
  /** Coins: margin × leverage / entry price. */
  size: number;
  /** The fee paid when opening, in dollars. */
  openFee: number;
  /** Unix milliseconds. */
  openedAt: number;
}

export interface OpenOrder {
  asset: string;
  side: Side;
  margin: number;
  leverage: number;
  price: number;
}

/** What opening an order costs from cash: the margin plus the opening fee. */
export function openCost(margin: number, leverage: number): number {
  return margin * (1 + leverage * FEE_RATE);
}

/** The largest margin that cash can pay for at this leverage, fee included. */
export function maxMargin(cash: number, leverage: number): number {
  return Math.max(0, cash / (1 + leverage * FEE_RATE));
}

/** Why an order can't be opened, or null if it can. */
export function orderProblem(order: OpenOrder, cash: number): string | null {
  if (!(order.price > 0)) return "No price yet";
  if (!(order.leverage >= 1 && order.leverage <= MAX_LEVERAGE)) return `Leverage must be 1× to ${MAX_LEVERAGE}×`;
  if (!(order.margin >= MIN_MARGIN)) return `At least $${MIN_MARGIN}`;
  // A cent of slack, so "100%" (which rounds) is never refused.
  if (openCost(order.margin, order.leverage) > cash + 0.005) return "Not enough cash";
  return null;
}

export function openPosition(order: OpenOrder, id: string, now: number): Position {
  const notional = order.margin * order.leverage;
  return {
    id,
    asset: order.asset,
    side: order.side,
    margin: order.margin,
    leverage: order.leverage,
    entryPrice: order.price,
    size: notional / order.price,
    openFee: notional * FEE_RATE,
    openedAt: now,
  };
}

function direction(side: Side): 1 | -1 {
  return side === "long" ? 1 : -1;
}

/** Unrealized profit (or loss, negative) at this price, before the closing fee. */
export function pnl(position: Position, price: number): number {
  return direction(position.side) * position.size * (price - position.entryPrice);
}

/** Profit as a fraction of the margin: 1 is +100%. */
export function roe(position: Position, price: number): number {
  return pnl(position, price) / position.margin;
}

/** The price at which the position's equity falls to the maintenance margin. */
export function liquidationPrice(position: Pick<Position, "side" | "leverage" | "entryPrice">): number {
  const move = 1 / position.leverage - MAINTENANCE_RATE;
  return position.entryPrice * (1 - direction(position.side) * move);
}

export function isLiquidated(position: Position, price: number): boolean {
  const liq = liquidationPrice(position);
  return position.side === "long" ? price <= liq : price >= liq;
}

/**
 * How far the price still is from liquidation, as a fraction of the way from entry: 1 at entry
 * (or better), 0 at the liquidation price. Drives the danger bar.
 */
export function safety(position: Position, price: number): number {
  const liq = liquidationPrice(position);
  const s = (price - liq) / (position.entryPrice - liq);
  return Math.min(1, Math.max(0, s));
}

/** What closing at this price pays back to cash: margin + PnL − closing fee, never below zero. */
export function closePayout(position: Position, price: number): number {
  const closeFee = position.size * price * FEE_RATE;
  return Math.max(0, position.margin + pnl(position, price) - closeFee);
}

/** A trade's result after all fees: what came back minus everything that went in. */
export function realized(position: Position, payout: number): number {
  return payout - position.margin - position.openFee;
}

/** Margin plus PnL: what the position is worth right now, for equity. */
export function positionValue(position: Position, price: number | undefined): number {
  if (price === undefined) return position.margin;
  return Math.max(0, position.margin + pnl(position, price));
}
