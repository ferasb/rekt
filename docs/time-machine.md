# Time Machine: plan

*Built on the `history-prototype` branch: §2–§4 below, except what §7 lists as still to do.*

A new room, **History** (`#history`): 150 years of the stock market on one chart, with every crash marked in red. Tap a crash and the camera dives into it, and the crash plays like a short film: your money on screen, the headlines of the time, and a few moments where you decide whether to panic. The aims are a game that's fun, polished and obvious to use.

## 1. The data

- **The whole US stock market, daily, July 1926 to last month**, dividends reinvested: Mkt-RF + RF from the **Kenneth R. French Data Library** (Fama/French 3 Factors, daily), the value-weighted return of every US company on the NYSE, AMEX and NASDAQ (CRSP). It tracks the S&P 500 closely: 10.2% a year since 1927 against 10.4%, with the same crash dates. Openly published for research and teaching with no licence or restrictions stated, and credited on the About page.
- **Why not the S&P 500 itself:** its daily data belongs to S&P Dow Jones Indices, FRED says it "may not be reproduced", and the free downloads are scraped from Yahoo. Robert Shiller's free monthly S&P 500 data was the first plan, but monthly averages soften fast crashes (COVID shows as −19% instead of −34%), and Feras wanted crashes at their real strength and speed.
- **Inflation:** the US consumer price index (CPI-U, BLS: public domain), monthly, via FRED. A month the BLS never published (October 2025, the shutdown) is filled in with the geometric mean of the months either side; the build stops on a longer gap, or if the CPI ends more than two months before the market data.
- `scripts/build-history.mjs` turns both into `web/src/market/history/us-market.json`: daily returns in basis points and day gaps, plus the monthly CPI. About 42 kB compressed, loaded only when the room opens. Rerun it with new downloads to bring the data up to date.
- The data has closing prices only, so candles are built from closes (each opens at the close before): nothing in between is invented.

## 2. The long view (the room's main screen)

- **The chart:** the US market from 1926 to today on a log scale (otherwise 1929 is invisible next to 2026). A smooth line over a glowing gradient. Drag to pan, pinch or scroll to zoom, and a mini-map underneath shows where you are.
- **Red bands:** every fall of 20% or more from a peak, computed from the data, not typed in by hand: 16 since 1926 (14 in today's dollars, where some merge). The chart's own click and hover events find the band (the canvas sits above it), so dragging and zooming keep working; the bands stay buttons for the keyboard. Each band carries a label, for example "1929 · Great Crash · −85%". The famous ones also have a name and a story; the rest are "Bear market 1906".
- **Hover or tap a band:** a card shows peak → bottom, how long the fall took, and how long until the old peak came back (1929: 15 years, in 1945, dividends reinvested).
- **One switch:** *Adjust for inflation* (dividends are always reinvested, since the data is total return). They change the story a lot, and showing that is part of the point. From the 1929 peak, the money came back after **15 years** with dividends reinvested (February 1945), and also about **15** counting inflation (prices fell in the early 1930s, then rose in the war, and the two about cancel out). On price alone it was famously 25 years (the Dow, 1954), but this data always includes dividends. In today's dollars, though, the 1970s become one −57% fall from 1968 that took until 1983 to recover. These figures are checked against the data (`findCrashes`).
- **The amount chip:** "Starting with **$1,000,000** ▾", with presets ($1,000, $10,000, $100,000, $1,000,000) and your own figure. It can also be set from outside through the address, `#history?amount=250000`, so a link can say "what if you had $250k in 2008".
- **First visit:** three coach marks, which you can skip and which never come back: "150 years of the US stock market" → "Red means a crash. Tap one" → "Choose how much you start with".

## 3. The crash film

1. **The dive.** Tap a band and the camera flies from the whole 150 years into the crash (about 1 second, eased). The rest of the chart fades, black letterbox bars slide in, and a title card appears: **"October 1929 · The Great Crash"**, with one line of context.
2. **The film.** The line draws itself month by month, and the camera follows. A drama score plays (Web Audio, mute in the top bar). On screen:
   - **Your money**, counting: $1,000,000 → $612,430, with the % change in red or green.
   - **The fall from the peak**, as a meter that fills.
   - **The date**, ticking, and **months underwater**.
   - **Headlines** at their real dates: "Oct 29, 1929: Black Tuesday", "Sep 15, 2008: Lehman Brothers files for bankruptcy". Only well-documented events, each checked, about four per crash.
3. **The decisions: this is the game.** The film pauses two or three times, at real moments (after the first big drop, near the bottom, in the recovery). **"Your $1M is now $612k. What do you do?"** You choose **Sell everything**, **Hold** or **Buy more** (with a cash reserve you start with). Each choice trades at that month's real price. The decisions are opt-in: a "Stop to decide" switch by the inflation one (off by default, `rekt:history-decide`), so a film plays straight through unless you ask for them, and the tour points at it.
4. **The ending.** The film runs to the recovery (the old peak regained) or to today. The result card shows:
   - **your path against the three simple ones:** held all along, sold at the bottom, and bought at the bottom
   - **what it meant:** "You'd have had your money back in March 2013, 5 years and 5 months later"
   - **a grade and a title:** "💎 Diamond hands", "🧻 Paper hands", "🦅 Bought the bottom"
   - **Copy result**, a one-line brag for the clipboard
5. **Controls throughout:** pause, Slow/Normal/Fast, skip to the end, replay, and ✕, which flies the camera back out to the long view.

**Honest numbers:** the line is drawn smoothly between months, but every figure on screen and every trade uses a real monthly price. Nothing is invented.

## 4. The extras that make it feel finished

- **Crash cards:** a row under the chart with a card per famous crash (illustrated icon, year, drop, recovery time). Your result and grade appear once you've played it, so it doubles as a progress collection: "4 of 6 survived". Each has an ⓘ button: a popup with what happened, in a few sentences (`about` in `crashes.ts`, facts only), a link to its Wikipedia article, and a button into the film. A merged crash (in today's dollars) shows each of its stories.
- **Badges:** "Survived 1929", "Held through 2008", "Bought every bottom", "Played them all".
- **The "what if" bar:** "If you'd put $1,000,000 in on [Jan 1990 ▾], today you'd have **$X**" (with or without inflation and dividends), counting up.
- **Sound and motion:** a whoosh for the dive, a tick on each new low, a heartbeat at the bottom, a chime for a full recovery. With reduced motion, no flying camera, letterbox or count-ups; the same story, as cross-fades.
- **Phones:** the chart is full width. The film goes full screen, with the readout at the top and the decisions as big buttons at the bottom.

## 5. Code

This room barely touches the live game. It has its own pure model and its own chart, so the trading panels need no refactor.
- `market/history/sp500.json`: Shiller's data, trimmed to the month, price, dividend and CPI, plus a script, `scripts/update-history.mjs`, that rebuilds it from Shiller's spreadsheet. It's run by hand once a month and committed.
- `game/history.ts`, pure and tested:
  - crash detection (≥20% from a peak, with the bottom and the recovery)
  - total return with dividends and the inflation adjustment
  - the film's timeline
  - the decision portfolio (cash, shares, trades at monthly prices)
  - the three simple paths and the grade
- `game/crashes.ts`: names, one-line stories and headlines (dates checked) for the famous crashes.
- `ui/history/`: the long view (Lightweight Charts with a custom "band" primitive for the red zones), the film (the same chart, its visible range animated, plus an HTML readout over it), the coach marks, and the cards.
- Saved: crash results and badges, `rekt:history`, validated on load; the stake, the inflation and "Stop to decide" switches, and the tour (`rekt:stake`, `rekt:history-real`, `rekt:history-decide`, `rekt:history-tour`). "Reset everything" in the menu wipes all of them (`clearHistory`), and the room starts again from nothing.

## 6. Build order

0. **A clickable prototype (half a session)**, with the real data: the long view with its red bands, and one crash film (2008) with the dive, the readout and one decision. It's for judging the look and feel before building the rest. You test it on localhost.
1. The long view: data, bands, cards, toggles, the amount chip, the coach marks.
2. The film: the dive, the timeline, the readout, the headlines, sound.
3. The decisions and the result card, plus the badges and the crash cards.
4. Polish: phones, reduced motion, the "what if" bar, About and Privacy updates, and Lighthouse.

Effort: about 5–6 sessions in all, the prototype included.

## 7. Status (on the branch)

Built: the long view (bands, labels in non-overlapping rows, cards, the inflation switch, the stake chip and `?amount=`, the tour), the film (dive, title card, candles paced with slow motion on big days, the readout, headlines, two decisions, the result against three paths), the "Stop to decide" switch (off by default), best results per crash, badges, and the "what if" calculator, and an info popup per famous crash with its Wikipedia link. 93 tests.

Still to do: Lighthouse and a performance pass on the 26,000-point chart on phones, a share image, and more crashes' stories (1946, 1962, 1990, 1998, 2018 and 2025 have bands but no names yet).
