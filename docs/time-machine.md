# Time Machine: plan

*Draft for Feras. Nothing is built yet.*

A new room, **History** (`#history`): 150 years of the stock market on one chart, with every crash marked in red. Tap a crash and the camera dives into it, and the crash plays like a short film: your money on screen, the headlines of the time, and a few moments where you decide whether to panic. The aims are a game that's fun, polished and obvious to use.

## 1. The data

- **S&P 500, monthly, January 1871 to last month**, from Robert Shiller's dataset (Yale): prices, dividends and inflation (CPI). It's published for research and teaching and used everywhere, with no formal licence; we credit it on the About page. It's bundled with the site (about 20 kB compressed), so no new connection is made.
- **What it can't do:** these are monthly averages, so fast crashes look milder (1987: −27% instead of −34%; COVID 2020: about −19%). The chart says "monthly averages" wherever it matters.
- **Not possible legally:** daily S&P 500 data (S&P Dow Jones Indices owns it, and FRED forbids reproducing it), and long histories of individual stocks. Free downloads of those are scraped from Yahoo, whose terms forbid redistribution.
- **Later:** Bitcoin and Ether, daily since 2015, from Coinbase (the same public API the game already uses).

## 2. The long view (the room's main screen)

- **The chart:** the S&P 500 from 1871 to today on a log scale (otherwise 1929 is invisible next to 2026). A smooth line over a glowing gradient. Drag to pan, pinch or scroll to zoom, and a mini-map underneath shows where you are.
- **Red bands:** every fall of 20% or more from a peak, computed from the data, not typed in by hand. Shiller's data has 13 of them since 1871. Each band carries a label, for example "1929 · Great Crash · −85%". The famous ones also have a name and a story; the rest are "Bear market 1906".
- **Hover or tap a band:** a card shows peak → bottom, how long the fall took, and how long until the old peak came back (1929: 25 years).
- **Two toggles:** *Adjust for inflation* and *Reinvest dividends*. They change the story a lot, and showing that is part of the point. From the 1929 peak, the money came back after **25 years** on price alone (1954), **15** with dividends reinvested (1945), and **7** with dividends and inflation counted (1936; prices fell in the 1930s). These figures are checked against the data.
- **The amount chip:** "Starting with **$1,000,000** ▾", with presets ($1,000, $10,000, $100,000, $1,000,000) and your own figure. It can also be set from outside through the address, `#history?amount=250000`, so a link can say "what if you had $250k in 2008".
- **First visit:** three coach marks, which you can skip and which never come back: "150 years of the US stock market" → "Red means a crash. Tap one" → "Choose how much you start with".

## 3. The crash film

1. **The dive.** Tap a band and the camera flies from the whole 150 years into the crash (about 1 second, eased). The rest of the chart fades, black letterbox bars slide in, and a title card appears: **"October 1929 · The Great Crash"**, with one line of context.
2. **The film.** The line draws itself month by month, and the camera follows. A drama score plays (Web Audio, mute in the top bar). On screen:
   - **Your money**, counting: $1,000,000 → $612,430, with the % change in red or green.
   - **The fall from the peak**, as a meter that fills.
   - **The date**, ticking, and **months underwater**.
   - **Headlines** at their real dates: "Oct 29, 1929: Black Tuesday", "Sep 15, 2008: Lehman Brothers files for bankruptcy". Only well-documented events, each checked, about four per crash.
3. **The decisions: this is the game.** The film pauses two or three times, at real moments (after the first big drop, near the bottom, in the recovery). **"Your $1M is now $612k. What do you do?"** You choose **Sell everything**, **Hold** or **Buy more** (with a cash reserve you start with). Each choice trades at that month's real price.
4. **The ending.** The film runs to the recovery (the old peak regained) or to today. The result card shows:
   - **your path against the three simple ones:** held all along, sold at the bottom, and bought at the bottom
   - **what it meant:** "You'd have had your money back in March 2013, 5 years and 5 months later"
   - **a grade and a title:** "💎 Diamond hands", "🧻 Paper hands", "🦅 Bought the bottom"
   - **Copy result**, a one-line brag for the clipboard
5. **Controls throughout:** pause, Slow/Normal/Fast, skip to the end, replay, and ✕, which flies the camera back out to the long view.

**Honest numbers:** the line is drawn smoothly between months, but every figure on screen and every trade uses a real monthly price. Nothing is invented.

## 4. The extras that make it feel finished

- **Crash cards:** a row under the chart with a card per famous crash (illustrated icon, year, drop, recovery time). Your result and grade appear once you've played it, so it doubles as a progress collection: "4 of 6 survived".
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
- Saved: crash results and badges, `rekt:history`, validated on load.

## 6. Build order

0. **A clickable prototype (half a session)**, with the real data: the long view with its red bands, and one crash film (2008) with the dive, the readout and one decision. It's for judging the look and feel before building the rest. You test it on localhost.
1. The long view: data, bands, cards, toggles, the amount chip, the coach marks.
2. The film: the dive, the timeline, the readout, the headlines, sound.
3. The decisions and the result card, plus the badges and the crash cards.
4. Polish: phones, reduced motion, the "what if" bar, About and Privacy updates, and Lighthouse.

Effort: about 5–6 sessions in all, the prototype included.
