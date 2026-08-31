import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSdk } from "../sdk-context";

/**
 * Bump this whenever the DATA SHAPE of any persisted query changes.
 *
 * The cache stores each query's result verbatim and restores it on boot, so a
 * release that changes a shape hands the new code the old value. That is not
 * theoretical: #211 changed realmHistory from `IndexerEvent[]` to
 * `{ events, callCount }`, and every returning user who had opened a realm's
 * History tab before that release got `undefined.length` and a crashed Browser
 * window. Bumping the envelope's own schema tag did not help — what is
 * persisted here is the inner `.data`, under an unversioned key.
 *
 * A stored entry is only restored when its version matches, so bumping this
 * makes every older entry inert: the app starts cold for one load and refetches
 * as normal. That is the cheap half of the trade; a crash loop is the expensive
 * one.
 */
export const CACHE_SCHEMA_VERSION = 2;

/** How an entry is filed: the version first, then the query's own key.
 *
 * Kept inside the stored key rather than in a new IndexedDB column so no
 * storage migration is needed — entries written before this simply parse to a
 * first element that is not the current version, and are skipped. */
export function persistedKey(queryKey: readonly unknown[]): string {
  return JSON.stringify([CACHE_SCHEMA_VERSION, ...queryKey]);
}

/** The query key inside a stored entry, or null if it was written by a
 * different schema version (or is not a versioned entry at all). */
export function restorableKey(queryKeyJson: string): unknown[] | null {
  const parsed: unknown = JSON.parse(queryKeyJson);
  if (!Array.isArray(parsed) || parsed.length === 0) return null;
  if (parsed[0] !== CACHE_SCHEMA_VERSION) return null;
  return parsed.slice(1);
}

/** Restores the last successful result of every query on boot (so a reload
 * shows the last-known value instantly instead of a spinner, while React
 * Query's normal refetch-on-mount runs in the background), and persists each
 * query's result after every successful fetch. FIFO eviction beyond 50
 * distinct queries is handled by sdk.queryCache itself. */
export function useQueryCachePersistence() {
  const sdk = useSdk();
  const queryClient = useQueryClient();
  const hydrated = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const entries = await sdk.queryCache.getAll();
        if (cancelled) return;
        for (const entry of entries) {
          try {
            const queryKey = restorableKey(entry.queryKeyJson);
            // null means "written by another schema version" — the value may
            // be a shape this build cannot read, so it is not restored.
            if (!queryKey) continue;
            queryClient.setQueryData(queryKey, entry.data, { updatedAt: entry.updatedAt });
          } catch {
            // Corrupt or outdated persisted entry — skip it rather than crash boot.
          }
        }
      } catch {
        // Reading the cache failed entirely (storage unavailable, a quota
        // error, a browser that blocks IndexedDB). Starting cold is a fine
        // outcome; the finally below is the important part.
      } finally {
        // Always, even when reading threw. This flag gates SAVING as well
        // as restoring, so leaving it false on a read failure quietly
        // disabled the cache for the rest of the session — a read problem
        // turning into a permanent write problem (AUD-006).
        hydrated.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sdk, queryClient]);

  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (!hydrated.current) return;
      if (event.type !== "updated" || event.action.type !== "success") return;
      const { query } = event;
      void sdk.queryCache.set(
        persistedKey(query.queryKey),
        query.state.data,
        query.state.dataUpdatedAt
      );
    });
    return unsubscribe;
  }, [sdk, queryClient]);
}
