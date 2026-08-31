import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSdk } from "./sdk-context";
import { useLiveEvents } from "./use-live-events";
import { rankByActivity, type ActivityRow } from "./rank-by-activity";

/**
 * "Which packages is this chain busy with" — from real history, not just from
 * whatever has happened since a window opened.
 *
 * Two callers used to answer this from the live feed alone, and both were
 * empty on arrival: Browser's home "Recently active" showed "Watching the
 * chain for activity…" with a caption admitting a proper ranking "would need
 * the indexer", and Developer libraries rendered "—" in an Activity column
 * that is also its DEFAULT SORT — so its default ordering meant nothing at
 * all. The indexer does have this: recentEvents() is the same backfill the
 * Event Explorer uses, and sharing its query key means all three cost one
 * request between them.
 *
 * Live events are merged in and still count. They are the newest thing that
 * happened, while the backfill is a snapshot from when the query ran, so a
 * package active in both should rank by the sum.
 * @returns {object} the ranking, a path→count lookup, and the query's state
 */
export function useRecentActivity(): {
  ranked: ActivityRow[];
  countByPath: Map<string, number>;
  isPending: boolean;
  error: Error | null;
  refetch: () => void;
  indexerConfigured: boolean;
} {
  const sdk = useSdk();
  const network = sdk.networks.getActive();
  const indexerConfigured = !!network.indexerGraphqlUrl;

  const { events } = useLiveEvents(false);
  const {
    data: backfill,
    error,
    isPending,
    refetch,
  } = useQuery({
    // Deliberately the Event Explorer's key — one fetch serves every caller.
    queryKey: ["recent-events", network.id],
    queryFn: async () => (await sdk.indexer.recentEvents()).data,
    enabled: indexerConfigured,
  });

  // Memoized: Developer libraries re-filters and re-sorts a two-thousand-entry
  // list off this map, and without memoization that ran on every render —
  // including every keystroke in its filter box and every live-event tick.
  const ranked = useMemo(
    () => rankByActivity([...events, ...(backfill ?? [])]),
    [events, backfill]
  );
  const countByPath = useMemo(
    () => new Map(ranked.map((row) => [row.packagePath, row.eventCount])),
    [ranked]
  );

  return {
    ranked,
    countByPath,
    // A network with no indexer never runs the query, so its perpetual
    // "pending" must not read as loading.
    isPending: indexerConfigured && isPending,
    error: error as Error | null,
    refetch: () => void refetch(),
    indexerConfigured,
  };
}
