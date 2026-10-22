# rekt

A trading game with play money and live crypto and stock prices: a static website with no backend, at rekt.ferasbisharat.com. `docs/design.md` is the design; read it before changing structure.

## Layout

- `web/`: the site (TypeScript, React, Zustand, Vite, TradingView Lightweight Charts).
  - `src/game/`: the rules. Pure: no DOM or React. `money.ts` (margin, PnL, liquidation, fees), `game.ts` (the whole game as actions returning a new game plus events), `away.ts` (liquidations while the page was closed), `titles.ts`, `roasts.ts`, `format.ts`.
  - `src/market/`: the exchanges, Coinbase (crypto) and Kraken (xStocks). `assets.ts` (ids and the featured list), `catalog.ts` (every listing, for search), `stockNames.ts`, `search.ts`, `feeds.ts` (the WebSockets and candles), `candles.ts`, `hours.ts`. All pure but `feeds.ts` and `catalog.ts`'s loading.
  - `src/persist/`: localStorage, validated on load.
  - `src/ui/`: React. `engine.ts` is the one place the game changes: it runs the feeds (and what they watch), applies actions, saves, and turns events into reactions. `prices.ts` (live prices, throttled for React), `fx/` (toasts, confetti, the REKT overlay, sounds), `charts/`, the panels.
  - `src/theme.css`: the palette shared with ferasbisharat.com (a copy; the original is `ferasb.github.io/theme.css`). `src/tokens.css`: this site's tokens.
  - `public/`: copied as is (About, Privacy, favicon, `theme-init.js`).
- `docs/`: the design, and how to deploy.
- `.github/workflows/`: CI (tests and build on every push) and the GitHub Pages deploy.

## Commands

- `cd web && npm run dev`: dev server on http://localhost:5173
- `cd web && npm test`: Vitest
- `cd web && npm run build`: type-check and production build

## Rules

- **Fit before you add.** Check a feature against `docs/design.md`; propose a restructure as its own step, then update the design.
- **The rules are pure.** Money math and game logic live in `src/game/`, with tests. Components only draw, and change the game only through `ui/engine.ts`.
- **Honest numbers.** Prices come only from the feed; the game never invents one. A change to the money math needs a test and an update to `design.md` §4 and the About page.
- **Up and down are never color alone**: ▲/▼ or a label, with `--up`/`--down`.
- **Colors are tokens** (`theme.css`, `tokens.css`), light and dark. Don't hard-code colors; static files in `public/` copy the values and say which.
- **Nothing from other sites** except Coinbase's and Kraken's market data: no third-party scripts, fonts or analytics. The CSP (`vite.config.ts`) enforces it and the privacy page promises it.
- **Reduced motion is respected**: no shake, confetti or count-ups with `prefers-reduced-motion`.
- **Narrow screens work.** Below 960px it's one column (`styles.css`).
