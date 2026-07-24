import { useLiveEvents } from "../use-live-events";
import { openRef } from "../shell/open-ref";

// A live, forward-only feed of this realm's own events (spec §9.5) — real
// per-tx decoding via block_results (ADR-016), filtered to one pkgPath.
// There's no backfill: events only start appearing from the moment this
// lens is opened, since historical event lookup needs the indexer, which
// isn't reachable from the browser (ADR-012/015).
export function RealmHistory({ packagePath }: { packagePath: string }) {
  const { events } = useLiveEvents(false, packagePath);

  return (
    <div className="realm-history">
      <p className="state-line">
        Live events for this realm, from now on — historical events aren&rsquo;t available without an
        indexer.
      </p>
      {events.length === 0 ? (
        <p className="state-line" aria-busy="true">
          Watching for events on {packagePath}…
        </p>
      ) : (
        <ul className="event-list">
          {events.map((event, i) => (
            <li key={`${event.height}-${event.txIndex}-${i}`} className="event-list__row">
              <div className="event-list__head">
                <button
                  type="button"
                  className="event-list__height"
                  onClick={(e) => openRef(`gno://_/block/${event.height}`, { x: e.clientX, y: e.clientY })}
                >
                  #{event.height}
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
      )}
    </div>
  );
}
