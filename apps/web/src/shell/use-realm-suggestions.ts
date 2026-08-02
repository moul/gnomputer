import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSdk } from "../sdk-context";
import { KNOWN_REALMS } from "../known-realms";
import { useLiveEvents } from "../use-live-events";
import { rankByActivity } from "../rank-by-activity";

export interface RealmSuggestion {
  label: string;
  packagePath: string;
}

const RPC_SUGGESTION_LIMIT = 20;
// Enough to not fire a query per keystroke, short enough that results still
// feel live while typing.
const DEBOUNCE_MS = 250;
// Same call and cap Discover > Packages already uses for its own full
// listing — a one-time (long staleTime) fetch, then a plain client-side
// substring filter per keystroke, not a query per keystroke.
const ALL_PACKAGES_LIMIT = 2000;
const ALL_PACKAGES_MATCH_LIMIT = 20;

// vm/qpaths matches real deployed package paths, which always carry the
// domain (gno.land/...) — bare "r/..."/"p/..." shorthand (same convention
// openEntityMatch's realm case uses) needs that prepended before it means
// anything to the chain.
export function packagePrefixFromQuery(query: string): string | null {
  const trimmed = query.trim();
  if (trimmed === "") return null;
  if (trimmed.startsWith("gno.land/")) return trimmed;
  if (trimmed.startsWith("r/") || trimmed.startsWith("p/")) return `gno.land/${trimmed}`;
  return null;
}

/** Realm-path autocomplete candidates. Five sources, most authoritative
 * first:
 *   1. A live vm/qpaths prefix search (genuine deployed packages, via RPC —
 *      no indexer, no CORS wall) once `query` looks like a package path.
 *   2. A substring match over a real, complete listing of every deployed
 *      package (sdk.rpc.listPackagesByPrefix("gno.land/", ...), the same
 *      call Discover > Packages already uses) — unlike (1), this works
 *      from the first keystroke regardless of whether the query looks
 *      path-shaped yet, and unlike (3) below it isn't limited to realms:
 *      typing "panictoerr" alone matches a /p/ library package like
 *      gno.land/p/aeddi/panictoerr just as well as any /r/ realm. No
 *      indexer needed — works on every network.
 *   3. A substring match over the indexer's real, complete REALM listing
 *      (sdk.indexer.listRealms) — kept alongside (2) since the indexer's
 *      own add_package history can surface a realm (2)'s RPC-side cap
 *      might miss. Falls back to nothing on networks with no indexer
 *      configured.
 *   4. The curated Staff Picks.
 *   5. Whatever packages have shown up in live chain activity.
 * (4) and (5) need no network round-trip and stay useful even before the
 * user has typed anything package-shaped yet.
 *
 * `active` gates both the live-events poll and the RPC/indexer lookups —
 * pass false while the input isn't focused/open so idle UI doesn't keep
 * querying in the background. */
export function useRealmSuggestions(active: boolean, query = ""): RealmSuggestion[] {
  const sdk = useSdk();
  const networkId = sdk.networks.getActive().id;
  const indexerConfigured = !!sdk.networks.getActive().indexerGraphqlUrl;
  const { events } = useLiveEvents(!active);
  const [rpcMatches, setRpcMatches] = useState<string[]>([]);
  const prefix = active ? packagePrefixFromQuery(query) : null;

  const { data: allPackages } = useQuery({
    queryKey: ["all-packages-suggest", networkId],
    queryFn: async () =>
      (await sdk.rpc.listPackagesByPrefix("gno.land/", ALL_PACKAGES_LIMIT, new Date().toISOString())).data,
    enabled: active,
    staleTime: 5 * 60 * 1000,
  });
  const { data: indexerRealms } = useQuery({
    queryKey: ["indexer-realms", networkId],
    queryFn: async () => (await sdk.indexer.listRealms()).data,
    enabled: active && indexerConfigured,
    staleTime: 60 * 1000,
  });
  const trimmedQuery = query.trim().toLowerCase();
  const allPackageMatches =
    trimmedQuery === "" || !allPackages
      ? []
      : allPackages.filter((p) => p.toLowerCase().includes(trimmedQuery)).slice(0, ALL_PACKAGES_MATCH_LIMIT);
  const indexerMatches =
    trimmedQuery === "" || !indexerRealms
      ? []
      : indexerRealms
          .filter((r) => r.packagePath.toLowerCase().includes(trimmedQuery))
          .slice(0, RPC_SUGGESTION_LIMIT)
          .map((r) => r.packagePath);

  useEffect(() => {
    if (prefix === null) {
      setRpcMatches([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void sdk.rpc
        .listPackagesByPrefix(prefix, RPC_SUGGESTION_LIMIT, new Date().toISOString())
        .then((env) => {
          if (!cancelled) setRpcMatches(env.data);
        })
        .catch(() => {
          // A transient RPC hiccup should just fall back to the static
          // suggestion sources below, not surface as an error in a dropdown.
          if (!cancelled) setRpcMatches([]);
        });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [sdk, prefix]);

  return combineSuggestions({
    rpcMatches,
    allPackageMatches,
    indexerMatches,
    knownRealms: KNOWN_REALMS,
    activityPaths: rankByActivity(events).map((row) => row.packagePath),
  });
}

/** Merges the five sources in precedence order, first mention winning.
 *
 * Extracted from the hook so the precedence and the de-duplication can be
 * asserted directly. It is the only part of this file with a decision in
 * it, and inside the hook it was reachable only through react-query, a
 * live-events poll and an SDK — which is a lot of machinery standing
 * between a test and a for-loop.
 *
 * A curated realm keeps its human label; everything else is labelled with
 * its own path. That is why order matters beyond ranking: if a Staff Pick
 * were merged before the RPC results it would still be listed once, but
 * with the curated label rather than the path the chain knows it by. */
export function combineSuggestions(sources: {
  rpcMatches: string[];
  allPackageMatches: string[];
  indexerMatches: string[];
  knownRealms: readonly RealmSuggestion[];
  activityPaths: string[];
}): RealmSuggestion[] {
  const seen = new Set<string>();
  const combined: RealmSuggestion[] = [];

  const addPath = (path: string) => {
    if (seen.has(path)) return;
    seen.add(path);
    combined.push({ label: path, packagePath: path });
  };

  for (const path of sources.rpcMatches) addPath(path);
  for (const path of sources.allPackageMatches) addPath(path);
  for (const path of sources.indexerMatches) addPath(path);
  for (const realm of sources.knownRealms) {
    if (seen.has(realm.packagePath)) continue;
    seen.add(realm.packagePath);
    combined.push(realm);
  }
  for (const path of sources.activityPaths) addPath(path);

  return combined;
}
