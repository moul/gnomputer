import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSdk } from "../sdk-context";

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
            const queryKey = JSON.parse(entry.queryKeyJson);
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
      void sdk.queryCache.set(JSON.stringify(query.queryKey), query.state.data, query.state.dataUpdatedAt);
    });
    return unsubscribe;
  }, [sdk, queryClient]);
}
