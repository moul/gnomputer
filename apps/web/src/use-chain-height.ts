import { useQuery } from "@tanstack/react-query";
import { useSdk } from "./sdk-context";

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
 * disturbing any other. */
export function useChainHeight(enabled = true): { height: number | null; isError: boolean } {
  const sdk = useSdk();
  const networkId = sdk.networks.getActive().id;

  const { data, isError } = useQuery({
    queryKey: ["chain-height", networkId],
    queryFn: async () => (await sdk.rpc.getStatus()).data.latestHeight,
    enabled,
    refetchInterval: CHAIN_HEIGHT_POLL_MS,
    refetchIntervalInBackground: false,
    // The tip height is the definition of volatile — never serve it stale.
    staleTime: 0,
    // A transient RPC hiccup shouldn't tear the feed down; the next interval
    // tick retries anyway, so failing fast keeps the error state honest.
    retry: 1,
  });

  return { height: data ?? null, isError };
}
