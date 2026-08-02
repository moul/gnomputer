import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSdk } from "../sdk-context";
import { useLiveEvents } from "../use-live-events";
import { rankByActivity } from "../rank-by-activity";
import { ErrorState } from "../shell/error-state";
import { openInRealmTab } from "../shell/open-in-realm-tab";
import { focusOrReopen } from "../shell/open-ref";
import { formatNumber } from "../format-number";

const PACKAGE_LIMIT = 2000;
// How many rows to render at once. Small enough that the initial DOM is
// cheap, large enough to fill any realistic window without a click.
const PAGE_SIZE = 100;

type SortKey = "path" | "activity";
type SortDir = "asc" | "desc";

export function DiscoverPackages() {
  const sdk = useSdk();
  const networkId = sdk.networks.getActive().id;
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("activity");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const {
    data: paths,
    error,
    isPending,
    refetch,
  } = useQuery({
    queryKey: ["all-packages", networkId],
    queryFn: async () => {
      const env = await sdk.rpc.listPackagesByPrefix("gno.land/", PACKAGE_LIMIT, new Date().toISOString());
      return env.data;
    },
  });

  // Live-observed activity since this window opened — the same
  // indexer-free signal Browser's Home "Recently active" section already
  // uses (there's no way to get a real historical activity ranking without
  // the indexer, see rank-by-activity.ts).
  const { events } = useLiveEvents(false);
  // Memoized: without this the map was rebuilt, and the whole 2000-entry
  // list re-filtered and re-sorted, on EVERY render — including every
  // keystroke in the filter box and every 4s live-event tick.
  const activityByPath = useMemo(
    () => new Map(rankByActivity(events).map((a) => [a.packagePath, a.eventCount])),
    [events]
  );

  // A new filter means a new result set — showing page 5 of the previous
  // one would be confusing.
  useEffect(() => setVisibleCount(PAGE_SIZE), [filter, sortKey, sortDir]);

  function openPackage(packagePath: string) {
    openInRealmTab("realm", { packagePath });
    focusOrReopen("realm");
  }

  const sorted = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const filtered = needle ? (paths ?? []).filter((p) => p.toLowerCase().includes(needle)) : (paths ?? []);
    return [...filtered].sort((a, b) => {
      const cmp =
        sortKey === "path" ? a.localeCompare(b) : (activityByPath.get(a) ?? 0) - (activityByPath.get(b) ?? 0);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [paths, filter, sortKey, sortDir, activityByPath]);

  // Render a page at a time instead of 500 rows up front. 500 interactive
  // rows is a lot of DOM to build before the user has even scrolled, and
  // it was rebuilt on every keystroke (AUD-039).
  const visible = sorted.slice(0, visibleCount);

  if (error) {
    return <ErrorState message="Could not list packages" error={error} onRetry={() => void refetch()} />;
  }
  if (isPending || !paths) {
    return (
      <p className="state-line" aria-busy="true">
        Loading packages…
      </p>
    );
  }

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "path" ? "asc" : "desc");
    }
  }

  function sortIndicator(key: SortKey): string {
    if (key !== sortKey) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }


  return (
    <div className="discover-packages">
      <div className="discover-packages__toolbar">
        <input
          type="text"
          autoComplete="off"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by path…"
        />
        <span className="state-line">{formatNumber(paths.length)} packages</span>
      </div>
      {sorted.length === 0 ? (
        <p className="state-line">No packages match &ldquo;{filter}&rdquo;.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>
                <button type="button" onClick={() => toggleSort("path")}>
                  Path{sortIndicator("path")}
                </button>
              </th>
              <th>
                <button type="button" onClick={() => toggleSort("activity")}>
                  Activity{sortIndicator("activity")}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((path) => (
              <tr key={path}>
                <td>
                  <button type="button" className="data-table__link" onClick={() => openPackage(path)}>
                    {path}
                  </button>
                </td>
                <td>{activityByPath.get(path) ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {sorted.length > visible.length && (
        <p className="state-line">
          Showing {formatNumber(visible.length)} of {formatNumber(sorted.length)} matches.{" "}
          <button type="button" onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}>
            Show more
          </button>
        </p>
      )}
    </div>
  );
}
