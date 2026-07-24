import { useEffect, useState } from "react";
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

// vm/qpaths matches real deployed package paths, which always carry the
// domain (gno.land/...) — bare "r/..."/"p/..." shorthand (same convention
// openEntityMatch's realm case uses) needs that prepended before it means
// anything to the chain.
function packagePrefixFromQuery(query: string): string | null {
  const trimmed = query.trim();
  if (trimmed === "") return null;
  if (trimmed.startsWith("gno.land/")) return trimmed;
  if (trimmed.startsWith("r/") || trimmed.startsWith("p/")) return `gno.land/${trimmed}`;
  return null;
}

/** Realm-path autocomplete candidates. Three sources, most authoritative
 * first:
 *   1. A live vm/qpaths prefix search (genuine deployed packages, via RPC —
 *      no indexer, no CORS wall) once `query` looks like a package path.
 *   2. The curated Staff Picks.
 *   3. Whatever packages have shown up in live chain activity.
 * (2) and (3) need no network round-trip and stay useful even before the
 * user has typed anything package-shaped yet.
 *
 * `active` gates both the live-events poll and the RPC lookups — pass false
 * while the input isn't focused/open so idle UI doesn't keep querying in
 * the background. */
export function useRealmSuggestions(active: boolean, query = ""): RealmSuggestion[] {
  const sdk = useSdk();
  const { events } = useLiveEvents(!active);
  const [rpcMatches, setRpcMatches] = useState<string[]>([]);
  const prefix = active ? packagePrefixFromQuery(query) : null;

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

  const activity = rankByActivity(events);
  const seen = new Set<string>();
  const combined: RealmSuggestion[] = [];
  for (const path of rpcMatches) {
    if (seen.has(path)) continue;
    seen.add(path);
    combined.push({ label: path, packagePath: path });
  }
  for (const realm of KNOWN_REALMS) {
    if (seen.has(realm.packagePath)) continue;
    seen.add(realm.packagePath);
    combined.push(realm);
  }
  for (const row of activity) {
    if (seen.has(row.packagePath)) continue;
    seen.add(row.packagePath);
    combined.push({ label: row.packagePath, packagePath: row.packagePath });
  }
  return combined;
}
