// Builds web/src/market/history/us-market.json from Ken French's daily factors file (docs/time-machine.md §1).
//
//   1. Download "Fama/French 3 Factors [Daily]" (CSV) from
//      https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/data_library.html and unzip it.
//   2. node scripts/build-history.mjs path/to/F-F_Research_Data_Factors_daily.csv
//
// The market's daily total return is Mkt-RF + RF (both in percent, two decimals): the value-weighted
// return, dividends included, of all US stocks on the NYSE, AMEX and NASDAQ. It's stored as whole
// basis points (exact), with each trading day as the number of days since the one before.
import { readFileSync, writeFileSync } from "node:fs";

const [input] = process.argv.slice(2);
if (!input) throw new Error("Usage: node scripts/build-history.mjs F-F_Research_Data_Factors_daily.csv");

const rows = [];
for (const line of readFileSync(input, "utf8").split("\n")) {
  const m = line.match(/^(\d{8}),\s*(-?[\d.]+),\s*-?[\d.]+,\s*-?[\d.]+,\s*(-?[\d.]+)/);
  if (!m) continue;
  const date = `${m[1].slice(0, 4)}-${m[1].slice(4, 6)}-${m[1].slice(6)}`;
  rows.push({ date, bp: Math.round((Number(m[2]) + Number(m[3])) * 100) });
}
if (rows.length < 20000) throw new Error(`Only ${rows.length} rows: is this the daily file?`);

const day = (d) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8)) / 86_400_000;
const gaps = rows.map((r, i) => (i === 0 ? 0 : day(r.date) - day(rows[i - 1].date)));
const out = {
  source: "Kenneth R. French Data Library, Fama/French 3 Factors [Daily]: Mkt-RF + RF (CRSP value-weighted US market, total return)",
  from: rows[0].date,
  to: rows.at(-1).date,
  gaps,
  bp: rows.map((r) => r.bp),
};
const path = new URL("../web/src/market/history/us-market.json", import.meta.url);
writeFileSync(path, JSON.stringify(out));
console.log(`${rows.length} trading days, ${out.from} to ${out.to} → ${path.pathname}`);
