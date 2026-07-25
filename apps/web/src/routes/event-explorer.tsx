import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useSdk } from "../sdk-context";
import { useLiveEvents } from "../use-live-events";
import { openRef } from "../shell/open-ref";
import { formatNumber } from "../format-number";
import { ErrorState } from "../shell/error-state";

interface RenderableEvent {
  height: number;
  txIndex: number;
  type: string;
  pkgPath?: string | null;
  attrs: { key: string; value: string }[];
}

function EventList({ events }: { events: RenderableEvent[] }) {
  return (
    <ul className="event-list">
      {events.map((event, i) => (
        <li key={`${event.height}-${event.txIndex}-${i}`} className="event-list__row">
          <div className="event-list__head">
            <button
              type="button"
              className="event-list__height"
              onClick={(e) => openRef(`gno://_/block/${event.height}`, { x: e.clientX, y: e.clientY })}
            >
              #{formatNumber(event.height)}
            </button>
            <span className="event-list__type">{event.type}</span>
            {event.pkgPath && <span className="event-list__pkg">{event.pkgPath}</span>}
          </div>
          {event.attrs.length > 0 && (
            <dl className="event-list__attrs">
              {event.attrs.map((attr) => (
                <span key={attr.key} className="event-list__attr">
                  <dt>{attr.key}</dt>
                  <dd>{attr.value}</dd>
                </span>
              ))}
            </dl>
          )}
        </li>
      ))}
    </ul>
  );
}

// Mirrors RealmHistory's own historical+live split (realm-history.tsx): the
// indexer (when configured) backfills real recent events immediately on
// open, so the feed isn't blank until the next live block happens to carry
// one. The RPC poll below still owns everything from the moment this
// mounts forward — the two aren't deduped against each other, same as
// RealmHistory, so a block that lands right at the seam could appear in
// both.
function RecentEvents() {
  const sdk = useSdk();
  const networkId = sdk.networks.getActive().id;
  const {
    data: events,
    error,
    isPending,
    refetch,
  } = useQuery({
    queryKey: ["recent-events", networkId],
    queryFn: async () => (await sdk.indexer.recentEvents()).data,
  });

  if (error) {
    return (
      <ErrorState message={`Could not load recent events: ${error.message}`} onRetry={() => void refetch()} />
    );
  }
  if (isPending) {
    return (
      <p className="state-line" aria-busy="true">
        Loading recent events…
      </p>
    );
  }
  if (events.length === 0) {
    return <p className="state-line">No recent events found.</p>;
  }
  return <EventList events={events} />;
}

export function EventExplorer() {
  const sdk = useSdk();
  const indexerConfigured = !!sdk.networks.getActive().indexerGraphqlUrl;
  const [paused, setPaused] = useState(false);
  const { events } = useLiveEvents(paused);

  return (
    <div className="event-explorer">
      <div className="recent-activity__toolbar">
        <button type="button" onClick={() => setPaused((p) => !p)}>
          {paused ? "▶ Resume" : "⏸ Pause"}
        </button>
      </div>
      {indexerConfigured && (
        <>
          <p className="state-line">Recent events, most recent first:</p>
          <RecentEvents />
          <p className="state-line">Live, from now on:</p>
        </>
      )}
      {events.length === 0 ? (
        <p className="state-line" aria-busy="true">
          Watching the chain for events…
        </p>
      ) : (
        <EventList events={events} />
      )}
    </div>
  );
}
