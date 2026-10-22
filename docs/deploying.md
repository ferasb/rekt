# Deploying

The site is static: `npm run build` in `web/` produces `web/dist/`, which any static host can serve. It's set up for **GitHub Pages** at `rekt.ferasbisharat.com`, deployed by `.github/workflows/deploy.yml`, like Bloch Sphere.

## First deploy

1. Push the repository to GitHub. GitHub Pages on the free plan needs a **public** repository; a private one needs GitHub Pro.
2. In the repository's **Settings → Pages**, set **Source** to **GitHub Actions**.
3. In **Actions → Deploy to GitHub Pages**, choose **Run workflow**. It runs the tests, builds and publishes.
4. To publish on every push to `main` from then on, add a repository variable (**Settings → Secrets and variables → Actions → Variables**) named `DEPLOY_PAGES` with the value `true`.

## The subdomain

1. **DNS** at Porkbun (where `ferasbisharat.com` lives): a `CNAME` record for `rekt` pointing to `ferasb.github.io`, the same as `bloch-sphere`.
2. In the repository's **Settings → Pages**, enter `rekt.ferasbisharat.com` under **Custom domain**. With deploys from Actions, no `CNAME` file is needed.
3. When GitHub has issued the certificate (minutes to a day), tick **Enforce HTTPS**.

If `ferasbisharat.com` isn't verified yet on the GitHub account (**Settings → Pages → Add a domain**), verify it first: that covers every subdomain and stops anyone else's repository from claiming them.

## Security and privacy

- **Content Security Policy.** The build adds a `<meta>` CSP (`vite.config.ts`): everything from the site itself, plus connections to Coinbase's market data (`https://api.exchange.coinbase.com`, `wss://ws-feed.exchange.coinbase.com`). The About and Privacy pages carry their own, stricter one. Check the browser console for "Refused to…" errors after changing what the page loads.
- **Coinbase.** If the game ever gets a lot of visitors, every browser opens its own WebSocket to Coinbase, which is how the public feed is meant to be used; there's no key to leak or rate limit to share.
- **The privacy page** (`web/public/privacy.html`) says what's stored and who the browser talks to. Update it if that changes (for example, a stock-price proxy).
