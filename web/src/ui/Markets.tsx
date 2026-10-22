import { useEffect, useMemo, useState } from "react";
import { price as fmtPrice } from "../game/format";
import { FEATURED_CRYPTO, FEATURED_STOCKS, assetById, type Asset, type Kind } from "../market/assets";
import { loadCatalog, useCatalog } from "../market/catalog";
import { searchAssets } from "../market/search";
import { unwatchAssets, useGame, watchAssets } from "./engine";
import { usePrices } from "./prices";
import { Pnl, useFlash } from "./widgets";

function Row({ asset, selected, onPick, open, showKind }: { asset: Asset; selected: boolean; onPick(): void; open: number; showKind?: boolean }) {
  const price = usePrices((s) => s.prices[asset.id]);
  const open24 = usePrices((s) => s.open24h[asset.id]);
  const flash = useFlash(price);
  return (
    <li>
      <button type="button" className={`market ${selected ? "selected" : ""}`} aria-pressed={selected} onClick={onPick} title={asset.blurb ?? asset.name}>
        <span className="market-name">
          <strong>
            {asset.symbol}
            {showKind && <span className="kind-tag">{asset.kind === "stock" ? "stock" : "crypto"}</span>}
          </strong>
          <span className="muted">{asset.name}</span>
        </span>
        <span className="market-price">
          <span className={`num ${flash}`}>{price ? fmtPrice(price) : "…"}</span>
          {price && open24 ? <Pnl fraction={price / open24 - 1} /> : <span className="muted">—</span>}
        </span>
        {open > 0 && (
          <span className="badge" title={`${open} open position${open > 1 ? "s" : ""}`}>
            {open}
          </span>
        )}
      </button>
    </li>
  );
}

/** The coins and stocks, with live prices and the day's change, and a search over all of them (design.md §2.1). */
export function Markets({ asset, onPick }: { asset: string; onPick(id: string): void }) {
  const positions = useGame((s) => s.game.positions);
  const catalog = useCatalog();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Kind>(() => assetById(asset).kind);
  const results = useMemo(() => searchAssets(catalog.assets, query), [catalog.assets, query]);
  const searching = query.trim() !== "";

  // Search results get live prices while they're listed.
  useEffect(() => {
    watchAssets("search", results.map((a) => a.id));
  }, [results]);
  useEffect(() => () => unwatchAssets("search"), []);

  const openCount = (id: string) => positions.filter((p) => p.asset === id).length;
  const featured = tab === "crypto" ? FEATURED_CRYPTO : FEATURED_STOCKS;
  // Yours first: what you hold or picked that isn't featured.
  const featuredIds = new Set(featured.map((a) => a.id));
  const yours = [...new Set([asset, ...positions.map((p) => p.asset)])]
    .map(assetById)
    .filter((a) => a.kind === tab && !featuredIds.has(a.id));
  const list = searching ? results : [...yours, ...featured];

  const pick = (id: string) => {
    onPick(id);
    setTab(assetById(id).kind);
  };

  return (
    <section className="panel markets" aria-label="Markets">
      <div className="market-search">
        <label htmlFor="market-search" className="sr-only">
          Search coins and stocks
        </label>
        <input
          id="market-search"
          type="search"
          placeholder="🔍 Search 600+ markets"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onFocus={loadCatalog}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results[0]) {
              pick(results[0].id);
              setQuery("");
            }
            if (e.key === "Escape") setQuery("");
          }}
        />
      </div>
      {!searching && (
        <div className="tabs market-tabs" role="tablist" aria-label="Kind">
          <button type="button" role="tab" aria-selected={tab === "crypto"} onClick={() => setTab("crypto")}>
            Crypto
          </button>
          <button type="button" role="tab" aria-selected={tab === "stock"} onClick={() => setTab("stock")}>
            Stocks
          </button>
        </div>
      )}
      {searching && results.length === 0 ? (
        <p className="empty small">{catalog.status === "loading" ? "Loading the full list…" : `Nothing called “${query.trim()}”.`}</p>
      ) : (
        <ul>
          {list.map((a) => (
            <Row key={a.id} asset={a} selected={a.id === asset} onPick={() => pick(a.id)} open={openCount(a.id)} showKind={searching} />
          ))}
        </ul>
      )}
      {searching && catalog.status === "failed" && <p className="empty small">Couldn't load every listing; showing what came.</p>}
      {!searching && tab === "stock" && (
        <p className="note">
          Stocks are <strong>xStocks</strong> on Kraken: tokens that track one share each. <a href="about.html#stocks">How that works</a>
        </p>
      )}
    </section>
  );
}
