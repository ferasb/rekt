// Builds web/src/market/history/us-market.json from Ken French's daily factors file (docs/time-machine.md §1).
//
//   1. Download "Fama/French 3 Factors [Daily]" (CSV) from
//      https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/data_library.html and unzip it.
//   2. Download the consumer price index (CPI-U, not seasonally adjusted, US government data) as CSV:
//      https://fred.stlouisfed.org/graph/fredgraph.csv?id=CPIAUCNS
//   3. node scripts/build-history.mjs path/to/F-F_Research_Data_Factors_daily.csv path/to/CPIAUCNS.csv
//
// The market's daily total return is Mkt-RF + RF (both in percent, two decimals): the value-weighted
// return, dividends included, of all US stocks on the NYSE, AMEX and NASDAQ. It's stored as whole
// basis points (exact), with each trading day as the number of days since the one before.
import { readFileSync, writeFileSync } from "node:fs";

const [input, cpiInput] = process.argv.slice(2);
if (!input || !cpiInput) throw new Error("Usage: node scripts/build-history.mjs F-F_Research_Data_Factors_daily.csv CPIAUCNS.csv");

const rows = [];
for (const line of readFileSync(input, "utf8").split("\n")) {
  const m = line.match(/^(\d{8}),\s*(-?[\d.]+),\s*-?[\d.]+,\s*-?[\d.]+,\s*(-?[\d.]+)/);
  if (!m) continue;
  const date = `${m[1].slice(0, 4)}-${m[1].slice(4, 6)}-${m[1].slice(6)}`;
  rows.push({ date, bp: Math.round((Number(m[2]) + Number(m[3])) * 100) });
}
if (rows.length < 20000) throw new Error(`Only ${rows.length} rows: is this the daily file?`);

// The CPI, monthly, from the market data's first month to its last published one. FRED leaves a month
// the BLS never published blank (or "."): October 2025, lost to the government shutdown. A lone gap
// is filled with the geometric mean of the months either side (and listed in the output); a longer one
// stops the build.
const cpiByMonth = new Map();
for (const line of readFileSync(cpiInput, "utf8").split("\n")) {
  const m = line.match(/^(\d{4}-\d{2})-01,(\d+(?:\.\d+)?)\s*$/);
  if (m) cpiByMonth.set(m[1], Number(m[2]));
}
const monthAfter = (key, n = 1) => {
  const [y, mo] = key.split("-").map(Number);
  const i = y * 12 + mo - 1 + n;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
};
const firstMonth = rows[0].date.slice(0, 7);
const lastMonth = [...cpiByMonth.keys()].sort().at(-1);
const cpi = [];
const filled = [];
for (let key = firstMonth; key <= lastMonth; key = monthAfter(key)) {
  if (cpiByMonth.has(key)) {
    cpi.push(cpiByMonth.get(key));
    continue;
  }
  const before = cpiByMonth.get(monthAfter(key, -1));
  const after = cpiByMonth.get(monthAfter(key));
  if (before === undefined || after === undefined) throw new Error(`The CPI is missing ${key} and a month beside it: too much to fill in.`);
  cpi.push(Math.round(Math.sqrt(before * after) * 1000) / 1000);
  filled.push(key);
}
if (cpi.length < 1000) throw new Error(`CPI covers only ${cpi.length} months from ${firstMonth}: is this CPIAUCNS?`);
// Today's dollars are the last CPI's: it must reach (nearly) the market data's last month.
const toMonth = rows.at(-1).date.slice(0, 7);
if (monthAfter(lastMonth, 2) < toMonth) throw new Error(`The CPI ends in ${lastMonth}, more than two months before the market data (${toMonth}): download a newer one.`);

const day = (d) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8)) / 86_400_000;
const gaps = rows.map((r, i) => (i === 0 ? 0 : day(r.date) - day(rows[i - 1].date)));
const out = {
  source: "Kenneth R. French Data Library, Fama/French 3 Factors [Daily]: Mkt-RF + RF (CRSP value-weighted US market, total return)",
  from: rows[0].date,
  to: rows.at(-1).date,
  gaps,
  bp: rows.map((r) => r.bp),
  // Monthly CPI from the first month; a month past the last one uses the last (not yet published).
  cpi: {
    from: firstMonth,
    source: `US Bureau of Labor Statistics CPI-U (CPIAUCNS), via FRED${filled.length ? `; not published, filled in from the months either side: ${filled.join(", ")}` : ""}`,
    values: cpi,
  },
};
const path = new URL("../web/src/market/history/us-market.json", import.meta.url);
writeFileSync(path, JSON.stringify(out));
console.log(`${rows.length} trading days, ${out.from} to ${out.to}; CPI for ${cpi.length} months to ${lastMonth}${filled.length ? ` (filled in: ${filled.join(", ")})` : ""} → ${path.pathname}`);
