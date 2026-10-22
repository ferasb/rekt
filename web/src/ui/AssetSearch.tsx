import { useEffect, useMemo, useState } from "react";
import { price as fmtPrice } from "../game/format";
import { loadCatalog, useCatalog } from "../market/catalog";
import { searchAssets } from "../market/search";
import { unwatchAssets, watchAssets } from "./engine";
import { usePrices } from "./prices";

function Result({ id, symbol, name, kind, onPick }: { id: string; symbol: string; name: string; kind: string; onPick(): void }) {
  const price = usePrices((s) => s.prices[id]);
  return (
    <li>
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onPick}>
        <strong>{symbol}</strong> <span className="muted">{name}</span>
        <span className="kind-tag">{kind}</span>
        <span className="num">{price ? fmtPrice(price) : "…"}</span>
      </button>
    </li>
  );
}

/** A search box with a dropdown of coins and stocks, for picking one (Up or Down's picker). */
export function AssetSearch({ onPick, disabled }: { onPick(id: string): void; disabled?: boolean }) {
  const catalog = useCatalog();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const results = useMemo(() => searchAssets(catalog.assets, query, 8), [catalog.assets, query]);
  const open = focused && query.trim() !== "";

  useEffect(() => {
    watchAssets("picker", open ? results.map((a) => a.id) : []);
  }, [results, open]);
  useEffect(() => () => unwatchAssets("picker"), []);

  const pick = (id: string) => {
    onPick(id);
    setQuery("");
  };

  return (
    <div className="asset-search">
      <label htmlFor="asset-search" className="sr-only">
        Search coins and stocks
      </label>
      <input
        id="asset-search"
        type="search"
        placeholder="🔍 Any coin or stock…"
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        value={query}
        onFocus={() => {
          setFocused(true);
          loadCatalog();
        }}
        onBlur={() => setFocused(false)}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && results[0]) pick(results[0].id);
          if (e.key === "Escape") setQuery("");
        }}
      />
      {open && (
        <ul className="asset-results">
          {results.length === 0 ? (
            <li className="empty small">{catalog.status === "loading" ? "Loading the full list…" : "No matches."}</li>
          ) : (
            results.map((a) => <Result key={a.id} id={a.id} symbol={a.symbol} name={a.name} kind={a.kind} onPick={() => pick(a.id)} />)
          )}
        </ul>
      )}
    </div>
  );
}
