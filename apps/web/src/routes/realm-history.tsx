import { useQuery } from "@tanstack/react-query";
import { useSdk } from "../sdk-context";
import { useLiveEvents } from "../use-live-events";
import { openRef } from "../shell/open-ref";
import { ErrorState } from "../shell/error-state";

interface RenderableEvent {
  height: number;
  txIndex: number;
  type: string;
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
              #{event.height.toLocaleString()}
            </button>
            <span className="event-list__type">{event.type}</span>
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

// The indexer's GraphQL endpoint now allows browser access (confirmed live
// 2026-07-25 — see rpc/src/indexer.ts's realmHistory), so a real historical
// backfill is available in addition to the live forward-only feed below.
// It's necessarily a proxy for "this realm's history", not a perfect one:
// it only finds events from transactions that directly called this realm
// (MsgCall.pkg_path), so an event emitted as a side effect of some OTHER
// realm's call (e.g. a token transfer nested inside a swap) wouldn't show
// up here even though it carries this realm's pkg_path.
function HistoricalEvents({ packagePath }: { packagePath: string }) {
  const sdk = useSdk();
  const networkId = sdk.networks.getActive().id;
  const {
    data: events,
    error,
    isPending,
    refetch,
  } = useQuery({
    queryKey: ["realm-history", networkId, packagePath],
    queryFn: async () => (await sdk.indexer.realmHistory(packagePath)).data,
  });

  if (error) {
    return (
      <ErrorState message={`Could not load history: ${error.message}`} onRetry={() => void refetch()} />
    );
  }
  if (isPending) {
    return (
      <p className="state-line" aria-busy="true">
        Loading historical events…
      </p>
    );
  }
  if (events.length === 0) {
    return (
      <p className="state-line">
        No historical events found for this realm — either it hasn&rsquo;t been called directly, or
        its calls didn&rsquo;t emit any of its own events (e.g. a shared library realm, or one whose
        events came from a different realm calling into it).
      </p>
    );
  }
  return <EventList events={events} />;
}

export function RealmHistory({ packagePath }: { packagePath: string }) {
  const sdk = useSdk();
  const indexerConfigured = !!sdk.networks.getActive().indexerGraphqlUrl;
  const { events } = useLiveEvents(false, packagePath);

  return (
    <div className="realm-history">
      {indexerConfigured && (
        <>
          <p className="state-line">Historical calls to this realm, most recent first:</p>
          <HistoricalEvents packagePath={packagePath} />
          <p className="state-line">Live, from now on:</p>
        </>
      )}
      {!indexerConfigured && (
        <p className="state-line">
          Live events for this realm, from now on — historical events aren&rsquo;t available without
          an indexer on this network.
        </p>
      )}
      {events.length === 0 ? (
        <p className="state-line" aria-busy="true">
          Watching for events on {packagePath}…
        </p>
      ) : (
        <EventList events={events} />
      )}
    </div>
  );
}
