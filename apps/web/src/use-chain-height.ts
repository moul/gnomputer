import { useQuery } from "@tanstack/react-query";
import { useSdk } from "./sdk-context";
import { useLiveUpdatesPaused } from "./shell/live-updates-store";

/** How often the tip height is re-checked. Matches what the hand-rolled
 * polling loops used, so perceived liveness is unchanged — the win here is
 * that there is now exactly ONE of these per network instead of one per
 * live-data hook per mounted window. */
export const CHAIN_HEIGHT_POLL_MS = 4000;

/** The chain's current tip height, as a single shared subscription.
 *
 * Every live-data feature used to run its own `getStatus()` loop on a
 * `setTimeout` (use-live-events / use-live-activity / use-live-transactions),
 * so opening Event Explorer + Transaction Explorer + Block Explorer meant
 * ~4 concurrent polls all asking the same question, none of them sharing a
 * result and none of them stopping when the tab was hidden.
 *
 * Routing it through react-query with a stable key means consumers
 * automatically share one in-flight request and one cache entry, and
 * `refetchIntervalInBackground: false` (react-query's default, made explicit
 * here because it's the point) stops the polling entirely for a backgrounded
 * tab.
 *
 * This is deliberately a poll and not a websocket subscription: Gno's RPC
 * does not serve `subscribe` — verified against the live endpoints, see
 * ADR-017. The transport is hidden behind this hook so upgrading later is a
 * one-file change.
 *
 * `enabled: false` (e.g. a paused feed) unsubscribes this consumer without
 * disturbing any other.
 *
 * Low-data mode and being offline both stop the poll here, which is the
 * whole reason that flag lives at this level: this is the single tick every
 * live view in the app is built on, so one switch stops the block feed, the
 * event feed, the transaction feed and the realm change-watch together
 * instead of each growing a pause button that only covers itself (AUD-042).
 *
 * The last known height is still returned while paused. Blanking it would
 * make every view that reads it look broken rather than frozen, and the
 * height is exactly the number that tells you how stale the rest is. */
export function useChainHeight(enabled = true): {
  height: number | null;
  isError: boolean;
  /** When the height currently being returned was actually fetched, as an
   * epoch ms (0 before the first success).
   *
   * `isError` is not enough to tell a live height from a frozen one. React
   * Query keeps reporting success while it holds data, so a poll that has been
   * failing for twenty minutes still looks fine to a consumer that only reads
   * `height` — and the island showed a confident, completely stale number the
   * whole time. The age of the last success is the honest signal. */
  dataUpdatedAt: number;
} {
  const sdk = useSdk();
  const networkId = sdk.networks.getActive().id;
  const paused = useLiveUpdatesPaused();

  const { data, isError, dataUpdatedAt } = useQuery({
    queryKey: ["chain-height", networkId],
    queryFn: async () => (await sdk.rpc.getStatus()).data.latestHeight,
    enabled: enabled && !paused,
    refetchInterval: CHAIN_HEIGHT_POLL_MS,
    refetchIntervalInBackground: false,
    // The tip height is the definition of volatile — never serve it stale.
    staleTime: 0,
    // A transient RPC hiccup shouldn't tear the feed down; the next interval
    // tick retries anyway, so failing fast keeps the error state honest.
    retry: 1,
  });

  return { height: data ?? null, isError, dataUpdatedAt };
}
