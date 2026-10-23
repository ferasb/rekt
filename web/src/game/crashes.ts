// The famous crashes' names, taglines and headlines, for the History room (docs/time-machine.md §3).
// Matched to the crashes found in the data by the date of the peak. Every headline is a well-documented
// event at its real date; numbers that the data can give (the drop, the bottom, the recovery) are left
// to the data, not written here.

export interface Headline {
  /** YYYY-MM-DD. On a day without trading it shows on the next trading day. */
  date: string;
  text: string;
}

export interface CrashStory {
  /** The day of the high before the fall, as found in the data: YYYY-MM-DD. */
  peak: string;
  name: string;
  /** For the crash cards and the title card. */
  emoji: string;
  tagline: string;
  headlines: Headline[];
}

export const CRASH_STORIES: readonly CrashStory[] = [
  {
    peak: "1929-09-03",
    name: "The Great Crash",
    emoji: "🎩",
    tagline: "The Roaring Twenties end, and the Great Depression begins.",
    headlines: [
      { date: "1929-10-24", text: "Black Thursday: panic selling hits Wall Street." },
      { date: "1929-10-28", text: "Black Monday: stocks fall more than 11% in a day." },
      { date: "1929-10-29", text: "Black Tuesday: another 11% gone. Ticker tape runs hours behind." },
      { date: "1930-06-17", text: "The Smoot–Hawley tariff becomes law. World trade shrinks." },
    ],
  },
  {
    peak: "1973-01-11",
    name: "Oil Shock",
    emoji: "🛢️",
    tagline: "An oil embargo, soaring inflation and Watergate.",
    headlines: [
      { date: "1973-10-17", text: "Arab oil producers announce an embargo. Oil prices soar." },
      { date: "1974-08-09", text: "President Nixon resigns over Watergate." },
    ],
  },
  {
    peak: "1987-08-25",
    name: "Black Monday",
    emoji: "📉",
    tagline: "The biggest one-day crash in stock market history.",
    headlines: [{ date: "1987-10-19", text: "Black Monday: the Dow falls 22.6% in a single day." }],
  },
  {
    peak: "2000-03-24",
    name: "Dot-com Bust",
    emoji: "💻",
    tagline: "The internet bubble bursts.",
    headlines: [
      { date: "2000-03-10", text: "The Nasdaq closes at a record 5,048." },
      { date: "2001-09-17", text: "Markets reopen after the September 11 attacks." },
      { date: "2002-07-21", text: "WorldCom files for bankruptcy, the largest in US history at the time." },
    ],
  },
  {
    peak: "2007-10-09",
    name: "Financial Crisis",
    emoji: "🏦",
    tagline: "Housing collapses and takes the banks down with it.",
    headlines: [
      { date: "2008-03-16", text: "Bear Stearns is sold to JPMorgan in a weekend rescue." },
      { date: "2008-09-15", text: "Lehman Brothers files for bankruptcy." },
      { date: "2008-09-29", text: "Congress rejects the bank bailout. The Dow falls 778 points." },
      { date: "2008-10-03", text: "The $700 billion bailout (TARP) is signed into law." },
    ],
  },
  {
    peak: "2020-02-19",
    name: "COVID Crash",
    emoji: "🦠",
    tagline: "The fastest fall into a bear market in history.",
    headlines: [
      { date: "2020-02-24", text: "COVID-19 spreads in Italy and South Korea. Fear hits markets." },
      { date: "2020-03-09", text: "Oil crashes. Trading halts minutes after the open." },
      { date: "2020-03-11", text: "The WHO declares COVID-19 a pandemic." },
      { date: "2020-03-16", text: "The worst day since 1987. Trading halts again." },
      { date: "2020-03-23", text: "The Fed promises to buy without limit." },
      { date: "2020-03-27", text: "The $2.2 trillion CARES Act is signed." },
    ],
  },
  {
    peak: "2021-11-08",
    name: "Inflation Bear",
    emoji: "🔥",
    tagline: "Inflation returns, and the Fed raises rates faster than in decades.",
    headlines: [
      { date: "2022-03-16", text: "The Fed raises rates for the first time since 2018." },
      { date: "2022-06-13", text: "Inflation fears push the S&P 500 into a bear market." },
    ],
  },
];

const byPeak = new Map(CRASH_STORIES.map((s) => [s.peak, s]));

export function storyFor(peakDate: string): CrashStory | undefined {
  return byPeak.get(peakDate);
}
