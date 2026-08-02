import { useEffect, useState } from "react";
import type { DataEnvelope } from "@gnomputer/app-sdk";
import { formatTimeAgo } from "../format-time-ago";

// Past this age, a cached-and-displayed value is more likely to be
// meaningfully out of date than merely "not refetched yet".
const STALE_WARNING_MS = 5 * 60 * 1000;

/** Shows when a query's currently-displayed data was last actually fetched —
 * meaningful once a value can come from the persisted query cache (instant
 * display on reload) rather than only ever being freshly fetched — and,
 * where it applies, where the data came from.
 *
 * "Updated 2m ago" answers a different question depending on the source. A
 * chain query is the chain's own answer as of that moment. An indexer query
 * is a separate service's view of the chain, which can lag behind it by an
 * unknown amount — so a fresh fetch of stale indexer data still reads
 * "Updated just now". Saying which one you are looking at is the difference
 * between a timestamp that means something and one that reassures falsely
 * (AUD-047).
 *
 * `source` comes from the DataEnvelope the adapter returned, not from the
 * call site's assumption about which adapter it used. */
export function Freshness({
  dataUpdatedAt,
  source,
}: {
  dataUpdatedAt: number;
  source?: DataEnvelope<unknown>["source"];
}) {
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
      {source === "indexer" && (
        <span
          className="freshness__source"
          title="From the transaction indexer, a separate service that reads the chain. It can lag behind the chain's own current state."
        >
          via indexer
        </span>
      )}
    </p>
  );
}
