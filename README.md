# rekt

A trading game with play money and live crypto and stock prices. Start with $10,000, go long or short with up to 100× leverage, or call the next minute in **Up or Down**, and try not to get rekt.

**Play:** https://rekt.ferasbisharat.com

- Live prices for 400+ coins (Coinbase) and about 175 stocks and ETFs (Kraken's xStocks, tokens that track a share), all from public market data: no key, no server. Search finds any of them by symbol or name.
- Leveraged long and short positions with real fees and liquidation prices, which keep going while the tab is closed.
- Up or Down rounds: 30 seconds, a minute or five; double or nothing.
- Ranks, streaks, stats, confetti, sounds and a lot of roasting. Bailouts when you go broke.
- No accounts, no analytics, no cookies from this site: the game lives in your browser.

## Running it

```sh
cd web
npm install
npm run dev     # http://localhost:5173
npm test        # Vitest
npm run build   # type-check and production build into web/dist
```

The design is in [`docs/design.md`](docs/design.md); deploying in [`docs/deploying.md`](docs/deploying.md).

Not financial advice. Not affiliated with Coinbase, Kraken, or any company listed.

## License

[MIT](LICENSE)
