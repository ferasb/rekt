// What you can trade (design.md §6.1): crypto from Coinbase, and stocks as Kraken's xStocks, tokens
// that track a share. The featured ones are listed here, with blurbs; the rest come from the
// exchanges' own lists when someone searches (catalog.ts).

import { STOCK_NAMES } from "./stockNames";

export type Source = "coinbase" | "kraken";
export type Kind = "crypto" | "stock";

export interface Asset {
  /** A Coinbase product id ("BTC-USD") or a Kraken xStock symbol ("AAPLx/USD"). */
  id: string;
  source: Source;
  kind: Kind;
  /** What people call it: "BTC", "AAPL". */
  symbol: string;
  name: string;
  blurb?: string;
}

const crypto = (symbol: string, name: string, blurb: string): Asset => ({ id: `${symbol}-USD`, source: "coinbase", kind: "crypto", symbol, name, blurb });
const stock = (symbol: string, name: string, blurb: string): Asset => ({ id: `${symbol}x/USD`, source: "kraken", kind: "stock", symbol, name, blurb });

export const FEATURED_CRYPTO: readonly Asset[] = [
  crypto("BTC", "Bitcoin", "The OG. Digital gold, analog volatility."),
  crypto("ETH", "Ethereum", "The world computer. Gas not included."),
  crypto("SOL", "Solana", "Fast chain, faster mood swings."),
  crypto("XRP", "XRP", "The army is always watching."),
  crypto("DOGE", "Dogecoin", "Much wow. Very volatile."),
  crypto("ADA", "Cardano", "Peer-reviewed patience."),
  crypto("AVAX", "Avalanche", "Snowballs both ways."),
  crypto("LINK", "Chainlink", "The oracle. Didn't see this coming either."),
  crypto("LTC", "Litecoin", "Silver to Bitcoin's gold. Allegedly."),
  crypto("SUI", "Sui", "New chain, who dis."),
  crypto("DOT", "Polkadot", "All the chains, connected. In theory."),
  crypto("BCH", "Bitcoin Cash", "Bitcoin, but with bigger blocks and bigger arguments."),
  crypto("HBAR", "Hedera", "Run by a council. Very corporate. Very serious."),
  crypto("NEAR", "NEAR", "Close to something."),
  crypto("AAVE", "Aave", "A bank with no bankers. Ghostly."),
  crypto("SHIB", "Shiba Inu", "Dogecoin's little cousin with big dreams."),
  crypto("PEPE", "Pepe", "Feels good man. Until it doesn't."),
  crypto("BONK", "Bonk", "It's in the name."),
  crypto("WIF", "dogwifhat", "A dog. With a hat. Billions."),
  crypto("TRUMP", "Official Trump", "A meme coin with a press office."),
  crypto("FARTCOIN", "Fartcoin", "Yes, really. It's real. People trade it."),
];

export const FEATURED_STOCKS: readonly Asset[] = [
  stock("AAPL", "Apple", "Sells phones. Also sells you the charger."),
  stock("TSLA", "Tesla", "A car company. Or a robot company. Or a meme."),
  stock("NVDA", "Nvidia", "Sells shovels in the AI gold rush."),
  stock("MSFT", "Microsoft", "Windows, Office, and a lot of the cloud."),
  stock("AMZN", "Amazon", "Everything store, everything cloud."),
  stock("GOOGL", "Alphabet", "Google's parent. You've searched for it."),
  stock("META", "Meta", "Facebook, Instagram, and a very expensive metaverse."),
  stock("NFLX", "Netflix", "Are you still watching?"),
  stock("AMD", "AMD", "The other chip company. Catching up, loudly."),
  stock("PLTR", "Palantir", "Data, defense and a very online fanbase."),
  stock("COIN", "Coinbase", "The exchange behind rekt's crypto prices."),
  stock("MSTR", "Strategy", "A software company that's mostly Bitcoin now."),
  stock("HOOD", "Robinhood", "The app that made trading a game. Like this one."),
  stock("GME", "GameStop", "To the moon, then back, then again."),
  stock("SPY", "S&P 500 ETF", "The 500 biggest US companies in one boring ticker."),
  stock("QQQ", "Nasdaq-100 ETF", "Big tech in a bundle."),
];

export const FEATURED: readonly Asset[] = [...FEATURED_CRYPTO, ...FEATURED_STOCKS];

export const DEFAULT_ASSET = "BTC-USD";

const COINBASE_ID = /^[A-Z0-9]{1,20}-USD$/;
const KRAKEN_ID = /^[A-Z0-9.]{1,12}x\/USD$/;

/** Whether this looks like an asset id (saved games are checked with it; the lists can change). */
export function isAssetId(id: unknown): id is string {
  return typeof id === "string" && (COINBASE_ID.test(id) || KRAKEN_ID.test(id));
}

export function sourceOf(id: string): Source {
  return KRAKEN_ID.test(id) ? "kraken" : "coinbase";
}

/** An asset known only by its id: its symbol stands in for the name (or, for a stock, stockNames.ts). */
export function assetFromId(id: string): Asset {
  if (sourceOf(id) === "kraken") {
    const symbol = id.slice(0, -"x/USD".length);
    return { id, source: "kraken", kind: "stock", symbol, name: STOCK_NAMES[symbol] ?? symbol };
  }
  const symbol = id.slice(0, -"-USD".length);
  return { id, source: "coinbase", kind: "crypto", symbol, name: symbol };
}

const known = new Map(FEATURED.map((a) => [a.id, a]));

/** Adds assets from the exchanges' lists; featured ones keep their names and blurbs. */
export function learnAssets(assets: readonly Asset[]): void {
  for (const a of assets) if (!known.has(a.id)) known.set(a.id, a);
}

export function assetById(id: string): Asset {
  return known.get(id) ?? assetFromId(id);
}

/** The line under the chart's title. */
export function blurbOf(asset: Asset): string {
  if (asset.blurb) return asset.blurb;
  return asset.kind === "stock" ? `A token on Kraken that tracks one ${asset.symbol} share.` : `${asset.name} on Coinbase.`;
}
