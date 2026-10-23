# rekt: design

A trading game with play money and live prices. Visitors start with $10,000 of fake money, open leveraged long and short positions on real crypto and stock prices, and watch what happens: rockets when they win, a big **REKT** when they get liquidated. No accounts, no server, no real money.

Lives at `rekt.ferasbisharat.com`. A static site (Vite, React, TypeScript, Zustand), like Bloch Sphere.

## 1. Goals

- **Fun first.** Every outcome gets a reaction: a count-up, a toast, confetti, a shake, a sound, a roast. Losing should be funny, not sad.
- **Honest numbers.** Prices are real (Coinbase, Kraken), and the money math works like a real exchange's isolated-margin perpetual futures, simplified (§4). The game never invents a price.
- **Nothing to sign up for.** Everything lives in the visitor's browser (§7).
- **Nothing hidden.** The only outside connections are to Coinbase's and Kraken's public market data (§6), and the privacy page says so.

## 2. Three rooms

The top bar switches between them (the URL hash: `#trade`, `#updown`, `#history`). Trade and Up or Down share the balance; History has its own money and never touches it.

### 2.1 Trade (the desk)

- **Markets**: a search over every coin and stock (§6.1), and, without a query, Crypto and Stocks tabs with the featured ones (plus any you hold or picked), each with live price and 24h change. Picking one shows it everywhere.
- **Chart**: candles (1m, 5m, 1h) from the exchange, extended live by every tick. For a stock, whether the US market is open. Your open positions on that coin draw their entry and liquidation prices as lines.
- **Order ticket**: Long (price goes up) or Short (goes down), the margin in dollars (presets 10/25/50/100% of cash), the leverage (1× to 100×, each step with a nickname), and a preview: position size, fee, liquidation price, and how far away it is.
- **Positions**: every open position with live profit or loss in dollars and percent, a bar showing how close it is to liquidation, and a Close button. Below them, the recent history.

### 2.2 Up or Down

Quick rounds: pick a coin or stock (quick picks, or search), a stake and a duration (30 s, 1 min, 5 min), then call **UP** or **DOWN**. The start price is locked, a countdown runs over a live mini-chart, and at the end:

- right call: the stake comes back doubled;
- wrong call: the stake is gone;
- exactly the same price: the stake comes back (a push).

The end price is the last one seen before the clock ran out (`markRound` in `game/game.ts`), not whatever is current when the page gets round to settling: a background tab's timers can fire long after the end. No house edge: it's a coin flip against the market. A win streak shows as 🔥×n; after a win, **Let it ride** bets the whole payout again. One round at a time.

### 2.3 History

A century of US stock market crashes, each playable as a film, with decisions and a result: see [`time-machine.md`](time-machine.md).

## 3. The player

- **Cash**: money not in a position or a round. **Equity**: cash + every position's margin and profit + the stake of a running round. The top bar shows equity, counting up and flashing on change.
- **Title**: a rank by equity, from "Totally Rekt" to "Satoshi's Cousin" (`game/titles.ts`). Shown with an emoji in the top bar; ranking up or down gets a toast.
- **Stats**: trades, wins, losses, liquidations, best and worst trade, all-time high, rounds won and lost, best streak, bailouts.
- **Bailout**: when equity drops below $10 with nothing open, a big button offers a fresh $10,000. Bailouts are counted, forever, as a badge of shame. **Reset** in the menu wipes everything.

## 4. The money math (`game/money.ts`)

Isolated-margin perpetual futures, simplified. All pure functions with tests.

- **Opening** with margin `m` at leverage `L` and price `p`: notional `N = m·L`, size `q = N / p` coins. The fee is `0.05%` of notional (a typical taker fee), paid from cash on top of the margin: cost `m·(1 + L·0.0005)`. So 100× costs 5% of the margin just to get in, which is part of the joke and part of the lesson.
- **Profit or loss** at mark price `x`: `q·(x − p)` for a long, `q·(p − x)` for a short.
- **Liquidation**: when the position's equity (margin + PnL) falls to the maintenance margin, `0.5%` of the entry notional. For a long that's at `p·(1 − 1/L + 0.005)`, for a short `p·(1 + 1/L − 0.005)`. The whole margin is lost. (Real exchanges use the mark price and tiered rates; this keeps one rate.)
- **Closing**: cash gets back `margin + PnL − closing fee` (0.05% of the notional at the closing price). Before liquidation this is always positive.
- **Realized result** of a trade, for stats and history: what came back minus the margin and the opening fee.
- Money is kept in floating-point dollars and shown rounded to cents. No order book: market orders fill at the last trade price.

## 5. While you were away

Positions stay open when the tab closes, as on a real exchange. The game remembers the last moment each exchange's feed watched the prices (`coveredUntil`). When it opens again, or a feed reconnects after a gap, it fetches that exchange's candles for each open position from that moment to now and checks whether a candle's low (long) or high (short) crossed the liquidation price. The first such candle liquidates the position, and the visitor gets the news: "While you were gone, your 50× long got rekt at 03:14."

The candle size is the smallest that covers the gap in one request: Coinbase returns at most 300 (1 m up to 5 h, then 5 m, 15 m, 1 h, 6 h, 1 day), Kraken its latest 720 (1 m up to 12 h, then 5 m, 15 m, 30 m, 1 h, 4 h, 1 day). Kraken's candles come from trades, while its live price is the mark price, so the two can differ slightly. Only candles starting after `coveredUntil` count, so a partial candle at the start of the gap is skipped (`game/away.ts`).

A round of Up or Down doesn't survive the tab closing: if it ended while the page was closed, it's void and the stake comes back ("You left the table").

## 6. Prices

### 6.1 What you can trade

- **Crypto**: every online Coinbase product against USD (400+), id `BTC-USD`.
- **Stocks**: Kraken's xStocks, tokens that each track one share of a stock or ETF (~175), id `AAPLx/USD`. Live stock exchange prices aren't free without a key; these are, and they're real prices of a real market. Kraken's API has no company names, so `market/stockNames.ts` adds them (only names we're sure of; the rest show their ticker).
- **Featured** (`market/assets.ts`): ~20 coins and ~16 stocks with blurbs, always on the markets list. The full lists (`market/catalog.ts`) load the first time someone searches (~95 kB) and are cached for a day. Saved games check ids by their shape, not against a list, since listings change.
- **Search** (`market/search.ts`): by symbol or name, best match first (exact symbol, then prefixes, then a word in the name).

### 6.2 The feeds

- **Live**: one WebSocket per exchange (`market/feeds.ts`), each watching a changing set of assets: subscribe what's new, unsubscribe what's gone. Watched: the featured ones, search results while listed, the picked one, and every open position and running round. An exchange with nothing to watch has no connection. Reconnects with backoff; a socket silent for 20 s is replaced. The top bar shows the worse of the two.
  - Coinbase: `wss://ws-feed.exchange.coinbase.com`, `ticker` channel: the latest price on subscribing, then every trade.
  - Kraken: `wss://ws.kraken.com/v2`, `ticker` channel with `event_trigger: "bbo"`. The price is the **mark price**, the middle of the best bid and ask: xStocks trade rarely (a few hundred trades a day), but market makers keep their quotes on the share. A heartbeat every second keeps the socket alive.
- **History**: Coinbase `GET /products/{id}/candles` (300 at most per request, with start and end); Kraken `GET /0/public/OHLC?asset_class=tokenized_asset` (only the latest 720, from trades). §5 picks the candle size per exchange so a gap fits.
- **Market hours** (`market/hours.ts`): xStocks trade around the clock, but outside the US session (weekdays 9:30–16:00 New York, holidays not counted) they barely move. The chart and Up or Down say so.
- **No cookies.** Both exchanges sit behind Cloudflare, which sets bot-management cookies (`__cf_bm`, `_cfuvid`; Kraken adds a language one). Every HTTP request is sent with `credentials: "omit"`, so none is sent or stored; a WebSocket can't opt out, so the browser's third-party cookie rules decide (privacy page).
- Ticks go into a small Zustand store (`ui/prices.ts`). The game reacts to them (liquidations) in the same place, so a liquidation never waits for React.

## 7. Storage

- `localStorage["rekt:game"]`: the whole game (cash, positions, history, stats, the running round), versioned and validated on load (`persist/game.ts`). Corrupt or unknown data starts a new game instead of crashing.
- `localStorage["rekt:covered"]` and `["rekt:covered:kraken"]`: each exchange's `coveredUntil` (§5), in their own keys because they change every few seconds.
- `localStorage["rekt:catalog"]`: the full listings, for a day (§6.1). `["rekt:asset"]`: the coin or stock picked last.
- `localStorage["rekt:theme"]`, `localStorage["rekt:sound"]`.
- Two tabs: a `storage` event from another tab replaces this tab's game, so both show the same money.

## 8. Look and feel

- The palette is `src/theme.css`, a copy of `ferasb.github.io/theme.css`; this site's own tokens are in `src/tokens.css`. Up is `--success` with ▲, down is `--danger` with ▼: never color alone.
- Display type: Bungee (self-hosted through `@fontsource`). Numbers use tabular figures so they don't jiggle.
- Reactions (`ui/fx/`): toasts, confetti, screen shake, the REKT overlay, and synthesized sounds (Web Audio, no files; mute in the top bar). With `prefers-reduced-motion`, no shaking, confetti or count-ups: the same news, in text.
- Wide screens: markets | chart and positions | ticket. Below 960 px: one scrolling column, ticket under the chart.

## 9. Not in scope (for now)

Real money, accounts, leaderboards (they'd need a server, and would be trivial to cheat), order types beyond market (take-profit and stop-loss are the first candidates), funding rates, real stock exchange prices (they'd need a paid feed and a proxy for its key).
