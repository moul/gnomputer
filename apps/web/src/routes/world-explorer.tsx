import { KNOWN_REALMS } from "../known-realms";
import { useLiveEvents } from "../use-live-events";
import { rankByActivity } from "../rank-by-activity";
import { openRef } from "../shell/open-ref";

// Browsing "the world" the spec describes (§17.2: realms, packages,
// namespaces, authors, dependency graphs, recently deployed code) mostly
// needs the indexer to enumerate anything beyond a single known package —
// and that indexer doesn't allow browser access yet (ADR-012/015). What's
// real and buildable without it: a curated directory, and a genuine
// "recently active" ranking computed live from decoded chain events
// (ADR-016) rather than from any index.
export function WorldExplorer() {
  const { events } = useLiveEvents(false);
  const activity = rankByActivity(events);

  function open(packagePath: string) {
    // openRef also focuses/reopens the Browser window itself — necessary
    // here since this is a *different* already-open window (Realmnet
    // Explorer) navigating a target window that may be closed or minimized.
    openRef(`gno://_/realm/${packagePath}`);
  }

  return (
    <div className="realm-browser-home">
      <section>
        <h3>System realms</h3>
        <ul className="realm-browser-home__list">
          {KNOWN_REALMS.map((realm) => (
            <li key={realm.packagePath}>
              <button type="button" onClick={() => open(realm.packagePath)}>
                {realm.label}
                <span className="realm-browser-home__path">{realm.packagePath}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3>Recently active</h3>
        {activity.length === 0 ? (
          <p className="state-line" aria-busy="true">
            Watching the chain for activity…
          </p>
        ) : (
          <ul className="realm-browser-home__list">
            {activity.map((row) => (
              <li key={row.packagePath}>
                <button type="button" onClick={() => open(row.packagePath)}>
                  {row.packagePath}
                  <span className="realm-browser-home__path">
                    {row.eventCount} recent {row.eventCount === 1 ? "event" : "events"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="state-line">
          Ranked from live events seen since this window opened — not a historical or complete
          ranking, which would need the indexer.
        </p>
      </section>
      <section>
        <h3>Not available yet</h3>
        <p className="state-line">
          Packages, namespaces, authors, world-wide dependency graphs, and recently deployed code
          all need the indexer to enumerate — it doesn&rsquo;t allow browser access on this network.
          A single realm&rsquo;s own dependencies are still visible in its Graph lens.
        </p>
      </section>
    </div>
  );
}
