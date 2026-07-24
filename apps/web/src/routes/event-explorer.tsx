import { useState } from "react";
import { useLiveEvents } from "../use-live-events";
import { openRef } from "../shell/open-ref";

export function EventExplorer() {
  const [paused, setPaused] = useState(false);
  const { events } = useLiveEvents(paused);

  return (
    <div className="event-explorer">
      <div className="recent-activity__toolbar">
        <button type="button" onClick={() => setPaused((p) => !p)}>
          {paused ? "▶ Resume" : "⏸ Pause"}
        </button>
      </div>
      {events.length === 0 ? (
        <p className="state-line" aria-busy="true">
          Watching the chain for events…
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
      )}
    </div>
  );
}
