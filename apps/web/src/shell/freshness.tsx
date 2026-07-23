import { useEffect, useState } from "react";
import { formatTimeAgo } from "../format-time-ago";

// Past this age, a cached-and-displayed value is more likely to be
// meaningfully out of date than merely "not refetched yet".
const STALE_WARNING_MS = 5 * 60 * 1000;

/** Shows when a query's currently-displayed data was last actually fetched —
 * meaningful once a value can come from the persisted query cache (instant
 * display on reload) rather than only ever being freshly fetched. */
export function Freshness({ dataUpdatedAt }: { dataUpdatedAt: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(interval);
  }, []);

  if (dataUpdatedAt === 0) return null;
  const stale = now - dataUpdatedAt > STALE_WARNING_MS;

  return (
    <p className="freshness" data-stale={stale}>
      {stale ? "⚠ " : ""}
      Updated {formatTimeAgo(new Date(dataUpdatedAt).toISOString(), now)}
      {stale ? " — this may be outdated" : ""}
    </p>
  );
}
