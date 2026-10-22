# rekt

A trading game with play money and live crypto prices. Start with $10,000, go long or short with up to 100× leverage, or call the next minute in **Up or Down**, and try not to get rekt.

**Play:** https://rekt.ferasbisharat.com

- Live prices for 14 coins from Coinbase's public market data. No key, no server.
- Leveraged long and short positions with real fees and liquidation prices, which keep going while the tab is closed.
- Up or Down rounds: 30 seconds, a minute or five; double or nothing.
- Ranks, streaks, stats, confetti, sounds and a lot of roasting. Bailouts when you go broke.
- No accounts, no cookies, no analytics: the game lives in your browser.

## Running it

```sh
cd web
npm install
npm run dev     # http://localhost:5173
npm test        # Vitest
npm run build   # type-check and production build into web/dist
```

The design is in [`docs/design.md`](docs/design.md); deploying in [`docs/deploying.md`](docs/deploying.md).

Not financial advice. Not affiliated with Coinbase.
