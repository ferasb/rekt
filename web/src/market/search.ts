// Finding a coin or stock by symbol or name. Pure.

import type { Asset } from "./assets";

/** How well an asset matches, lower is better, or null for no match. */
function rank(asset: Asset, q: string): number | null {
  const symbol = asset.symbol.toLowerCase();
  const name = asset.name.toLowerCase();
  if (symbol === q) return 0;
  if (name === q) return 1;
  if (symbol.startsWith(q)) return 2;
  if (name.startsWith(q)) return 3;
  // A word in the name: "cash" finds Bitcoin Cash.
  if (name.split(/[\s-]+/).some((w) => w.startsWith(q))) return 4;
  if (symbol.includes(q) || name.includes(q)) return 5;
  return null;
}

/**
 * The assets matching a query, best first; ties keep the list's order (featured first). An empty
 * query matches nothing.
 */
export function searchAssets(assets: readonly Asset[], query: string, limit = 30): Asset[] {
  const q = query.trim().toLowerCase().replace(/^\$/, "");
  if (!q) return [];
  const hits: { asset: Asset; rank: number; index: number }[] = [];
  assets.forEach((asset, index) => {
    const r = rank(asset, q);
    if (r !== null) hits.push({ asset, rank: r, index });
  });
  hits.sort((a, b) => a.rank - b.rank || a.index - b.index);
  return hits.slice(0, limit).map((h) => h.asset);
}
