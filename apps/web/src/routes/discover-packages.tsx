import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSdk } from "../sdk-context";
import { useLiveEvents } from "../use-live-events";
import { rankByActivity } from "../rank-by-activity";
import { ErrorState } from "../shell/error-state";
import { openInRealmTab } from "../shell/open-in-realm-tab";
import { focusOrReopen } from "../shell/open-ref";
import { formatNumber } from "../format-number";

const PACKAGE_LIMIT = 2000;

type SortKey = "path" | "activity";
type SortDir = "asc" | "desc";

export function DiscoverPackages() {
  const sdk = useSdk();
  const networkId = sdk.networks.getActive().id;
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("activity");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

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
  const activityByPath = new Map(rankByActivity(events).map((a) => [a.packagePath, a.eventCount]));

  function openPackage(packagePath: string) {
    openInRealmTab("realm", { packagePath });
    focusOrReopen("realm");
  }

  if (error) {
    return <ErrorState message={`Could not list packages: ${error.message}`} onRetry={() => void refetch()} />;
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

  const filtered = filter.trim()
    ? paths.filter((p) => p.toLowerCase().includes(filter.trim().toLowerCase()))
    : paths;
  const sorted = [...filtered].sort((a, b) => {
    const cmp =
      sortKey === "path" ? a.localeCompare(b) : (activityByPath.get(a) ?? 0) - (activityByPath.get(b) ?? 0);
    return sortDir === "asc" ? cmp : -cmp;
  });

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
            {sorted.slice(0, 500).map((path) => (
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
      {sorted.length > 500 && (
        <p className="state-line">Showing the first 500 of {formatNumber(sorted.length)} matches.</p>
      )}
    </div>
  );
}
