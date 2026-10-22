import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

/**
 * The Content Security Policy, as a <meta> tag because GitHub Pages can't send headers. Everything
 * comes from this site, except the prices: Coinbase's public market data, over HTTPS and a WebSocket
 * (design.md §6.2). No third-party scripts, fonts or analytics. Inline styles are allowed for React's
 * style props (the danger bars, confetti). (frame-ancestors only works as a header, so it's absent.)
 * Added at build time only: the dev server needs inline scripts for hot reload.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self' https://api.exchange.coinbase.com wss://ws-feed.exchange.coinbase.com",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

function contentSecurityPolicy(): Plugin {
  return {
    name: "content-security-policy",
    apply: "build",
    transformIndexHtml: () => [{ tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: CSP }, injectTo: "head-prepend" }],
  };
}

/**
 * public/theme-init.js, first in the page's <head>: a classic script, so it applies a picked theme
 * before the first paint. Added here because Vite would warn about it in the HTML (it can't bundle a
 * script that isn't a module).
 */
function themeInit(): Plugin {
  return {
    name: "theme-init",
    transformIndexHtml: () => [{ tag: "script", attrs: { src: "theme-init.js" }, injectTo: "head-prepend" }],
  };
}

export default defineConfig({
  // Both add to the start of <head>, the later one first: the CSP ends up first, before any script.
  plugins: [react(), themeInit(), contentSecurityPolicy()],
  // Relative asset paths, so the build works from any subpath (e.g. GitHub Pages).
  base: "./",
  build: {
    rolldownOptions: {
      output: {
        // Libraries in their own chunks: they download in parallel and stay cached across app updates.
        codeSplitting: {
          groups: [
            { name: "charts", test: /node_modules[\\/](lightweight-charts|fancy-canvas)[\\/]/, priority: 3 },
            { name: "react", test: /node_modules[\\/](react|react-dom|scheduler|zustand)[\\/]/, priority: 2 },
            { name: "vendor", test: /node_modules[\\/]/, priority: 1 },
          ],
        },
      },
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
