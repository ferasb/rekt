import { useEffect, useState } from "react";
import { usMarketOpen } from "../market/hours";

/** For stocks: whether the US market is open, checked every minute. */
export function MarketHours({ closedNote }: { closedNote?: string }) {
  const [open, setOpen] = useState(() => usMarketOpen(new Date()));
  useEffect(() => {
    const timer = setInterval(() => setOpen(usMarketOpen(new Date())), 60_000);
    return () => clearInterval(timer);
  }, []);
  return open ? (
    <p className="hours open">● US market open</p>
  ) : (
    <p className="hours closed" title="xStocks trade around the clock, but with the stock market closed there's little news, so prices move slowly.">
      ☾ US market closed: prices move slowly{closedNote ? `. ${closedNote}` : ""}
    </p>
  );
}
