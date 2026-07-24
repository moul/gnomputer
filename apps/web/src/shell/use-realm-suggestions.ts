import { KNOWN_REALMS } from "../known-realms";
import { useLiveEvents } from "../use-live-events";
import { rankByActivity } from "../rank-by-activity";

export interface RealmSuggestion {
  label: string;
  packagePath: string;
}

/** Realm-path autocomplete candidates: the curated Staff Picks plus whatever
 * packages have shown up in live chain activity — both fully client-side,
 * neither needing the indexer (CORS-blocked from the browser on this
 * network, see rpc/src/indexer.ts). Not exhaustive, just what's actually
 * knowable without it.
 *
 * `active` gates the underlying live-events poll — pass false while the
 * input isn't focused/open so idle UI doesn't keep polling in the
 * background. */
export function useRealmSuggestions(active: boolean): RealmSuggestion[] {
  const { events } = useLiveEvents(!active);
  const activity = rankByActivity(events);
  const known = new Set(KNOWN_REALMS.map((r) => r.packagePath));
  const fromActivity = activity
    .filter((a) => !known.has(a.packagePath))
    .map((a) => ({ label: a.packagePath, packagePath: a.packagePath }));
  return [...KNOWN_REALMS, ...fromActivity];
}
