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
  /** What happened and why, in a few sentences, for the crash's info popup. */
  about: string;
  /** Its English Wikipedia article. */
  wiki: string;
  headlines: Headline[];
  /** When adjusting for inflation merges crashes into one: the stories it's made of, in order. */
  parts?: CrashStory[];
}

export const CRASH_STORIES: readonly CrashStory[] = [
  {
    peak: "1929-09-03",
    name: "The Great Crash",
    emoji: "🎩",
    tagline: "The Roaring Twenties end, and the Great Depression begins.",
    about: "After a decade of people borrowing to buy stocks, prices broke in October 1929. Over the next three years thousands of banks failed, a quarter of American workers lost their jobs, and the Great Depression set in. It's the deepest fall on the chart.",
    wiki: "https://en.wikipedia.org/wiki/Wall_Street_crash_of_1929",
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
    about: "The dollar's link to gold had just ended and prices were rising. Then Arab oil producers cut off the US and the price of oil quadrupled. With Watergate and a recession on top, stocks fell through 1973 and 1974, and rising prices made the real loss deeper still.",
    wiki: "https://en.wikipedia.org/wiki/1973%E2%80%931974_stock_market_crash",
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
    about: "Stocks had climbed fast all year. On Monday, October 19, a wave of selling, sped up by computer-driven trading and “portfolio insurance”, became the biggest one-day fall ever. The Fed promised the banks all the cash they needed, and no depression followed.",
    wiki: "https://en.wikipedia.org/wiki/Black_Monday_(1987)",
    headlines: [{ date: "1987-10-19", text: "Black Monday: the Dow falls 22.6% in a single day." }],
  },
  {
    peak: "2000-03-24",
    name: "Dot-com Bust",
    emoji: "💻",
    tagline: "The internet bubble bursts.",
    about: "In the late 1990s investors poured money into almost any company with “.com” in its name, many with no profits at all. When the money ran out in 2000, the tech-heavy Nasdaq lost almost four-fifths of its value. September 11 and the Enron and WorldCom scandals dragged the fall out.",
    wiki: "https://en.wikipedia.org/wiki/Dot-com_bubble",
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
    about: "Banks had lent to home buyers who couldn't repay, then sold the loans on, bundled into securities, around the world. When house prices fell, the losses spread through the whole banking system. Lehman Brothers' bankruptcy in September 2008 turned it into a panic, and the Great Recession followed.",
    wiki: "https://en.wikipedia.org/wiki/2008_financial_crisis",
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
    about: "As COVID-19 spread, countries locked down and businesses closed almost overnight. Stocks fell faster than ever before. Then the Fed and Congress stepped in with trillions of dollars, and the market climbed back within months, while the pandemic was still going.",
    wiki: "https://en.wikipedia.org/wiki/2020_stock_market_crash",
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
    about: "As the world reopened after the pandemic, prices rose at their fastest pace in 40 years. The Fed raised interest rates quickly to cool them, and stocks and bonds fell together, tech stocks hardest. Russia's invasion of Ukraine added to the fear.",
    wiki: "https://en.wikipedia.org/wiki/2022_stock_market_decline",
    headlines: [
      { date: "2022-03-16", text: "The Fed raises rates for the first time since 2018." },
      { date: "2022-06-13", text: "Inflation fears push the S&P 500 into a bear market." },
    ],
  },
];

/** How far (in days) a crash's peak may be from a story's and still be that story. */
const NEAR_DAYS = 400;

/**
 * Each crash's story, by crash index. A story belongs to the crash whose fall (peak to bottom)
 * contains the story's peak, or else whose peak is within about a year of it: adjusting for
 * inflation can move a peak, and can merge two crashes into one long one (in today's dollars,
 * 2000 to 2009 is a single fall). Then the stories merge too: "Dot-com Bust → Financial Crisis",
 * with both sets of headlines.
 */
export function matchStories(crashes: readonly { peak: number; bottom: number }[]): Map<number, CrashStory> {
  const found = new Map<number, CrashStory[]>();
  for (const story of CRASH_STORIES) {
    const t = Date.parse(`${story.peak}T00:00:00Z`) / 1000;
    let index = crashes.findIndex((c) => t >= c.peak && t <= c.bottom);
    if (index === -1) {
      let nearest = Infinity;
      crashes.forEach((c, i) => {
        const gap = Math.abs(c.peak - t);
        if (gap <= NEAR_DAYS * 86_400 && gap < nearest) {
          nearest = gap;
          index = i;
        }
      });
    }
    if (index !== -1) found.set(index, [...(found.get(index) ?? []), story]);
  }
  const out = new Map<number, CrashStory>();
  for (const [index, stories] of found) {
    if (stories.length === 1) {
      out.set(index, stories[0]);
      continue;
    }
    out.set(index, {
      peak: stories[0].peak,
      name: stories.map((s) => s.name).join(" → "),
      emoji: stories[0].emoji,
      tagline: `${stories[0].tagline} Then: ${stories.slice(1).map((s) => s.tagline.charAt(0).toLowerCase() + s.tagline.slice(1)).join(" Then: ")}`,
      about: stories.map((s) => s.about).join(" "),
      wiki: stories[0].wiki,
      headlines: stories.flatMap((s) => s.headlines).sort((a, b) => a.date.localeCompare(b.date)),
      parts: stories,
    });
  }
  return out;
}
