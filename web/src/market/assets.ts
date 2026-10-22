// The coins (design.md §6.1), all Coinbase products against USD.

export interface Asset {
  /** The Coinbase product id. */
  id: string;
  symbol: string;
  name: string;
  blurb: string;
}

export const ASSETS: readonly Asset[] = [
  { id: "BTC-USD", symbol: "BTC", name: "Bitcoin", blurb: "The OG. Digital gold, analog volatility." },
  { id: "ETH-USD", symbol: "ETH", name: "Ethereum", blurb: "The world computer. Gas not included." },
  { id: "SOL-USD", symbol: "SOL", name: "Solana", blurb: "Fast chain, faster mood swings." },
  { id: "XRP-USD", symbol: "XRP", name: "XRP", blurb: "The army is always watching." },
  { id: "DOGE-USD", symbol: "DOGE", name: "Dogecoin", blurb: "Much wow. Very volatile." },
  { id: "ADA-USD", symbol: "ADA", name: "Cardano", blurb: "Peer-reviewed patience." },
  { id: "AVAX-USD", symbol: "AVAX", name: "Avalanche", blurb: "Snowballs both ways." },
  { id: "LINK-USD", symbol: "LINK", name: "Chainlink", blurb: "The oracle. Didn't see this coming either." },
  { id: "LTC-USD", symbol: "LTC", name: "Litecoin", blurb: "Silver to Bitcoin's gold. Allegedly." },
  { id: "SUI-USD", symbol: "SUI", name: "Sui", blurb: "New chain, who dis." },
  { id: "SHIB-USD", symbol: "SHIB", name: "Shiba Inu", blurb: "Dogecoin's little cousin with big dreams." },
  { id: "PEPE-USD", symbol: "PEPE", name: "Pepe", blurb: "Feels good man. Until it doesn't." },
  { id: "BONK-USD", symbol: "BONK", name: "Bonk", blurb: "It's in the name." },
  { id: "WIF-USD", symbol: "WIF", name: "dogwifhat", blurb: "A dog. With a hat. Billions." },
];

export const DEFAULT_ASSET = "BTC-USD";

const byId = new Map(ASSETS.map((a) => [a.id, a]));

export function assetById(id: string): Asset | undefined {
  return byId.get(id);
}

export function isAsset(id: unknown): id is string {
  return typeof id === "string" && byId.has(id);
}
