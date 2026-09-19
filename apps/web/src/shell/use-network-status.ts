import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useSdk } from "../sdk-context";
import { useLiveUpdatesPaused } from "./live-updates-store";
import type { NetworkConfig } from "@gnomputer/app-sdk";

export type ConnectionState = "connecting" | "connected" | "error";

export interface ChainIdMismatch {
  configured: string;
  reported: string;
}

/** The chain id this network is configured with, and the one the node
 * actually reports, when they disagree.
 *
 * Nothing else notices this. `assertChainMatch` compares the *wallet* against
 * the configured id (AUD-002), so a wrong entry in DEFAULT_NETWORKS refuses
 * every signature while pointing the blame at the wallet, and the clock
 * popover displays the node's own id next to a configured value nobody ever
 * compared it to. Mainnet shipped configured as "gnoland1" against a chain
 * calling itself "gnoland-1", and the only symptom was signing failing.
 *
 * A custom network whose id could not be discovered is "unknown", which is
 * the absence of a claim rather than a conflicting one, and signing is
 * already blocked there. */
export function findChainIdMismatch(
  configured: string | undefined,
  reported: string | undefined
): ChainIdMismatch | undefined {
  if (!configured || configured === "unknown") return undefined;
  if (!reported || reported === configured) return undefined;
  return { configured, reported };
}

interface NetworkStatusData {
  chainId: string;
  latestHeight: number;
  latencyMs: number;
}

export function useNetworkStatus(): UseQueryResult<NetworkStatusData> & {
  network: NetworkConfig;
  state: ConnectionState;
  chainIdMismatch: ChainIdMismatch | undefined;
} {
  const sdk = useSdk();
  const network = sdk.networks.getActive();
  // Paused too, or "nothing is polling the chain" would be a lie: this is a
  // second getStatus loop, on its own five-second interval, and an e2e caught
  // it still running after low-data mode was switched on (AUD-042).
  const paused = useLiveUpdatesPaused();

  const query = useQuery({
    queryKey: ["network-status", network.id],
    queryFn: async () => {
      const start = performance.now();
      const env = await sdk.rpc.getStatus();
      const latencyMs = Math.round(performance.now() - start);
      return { ...env.data, latencyMs };
    },
    refetchInterval: 5000,
    enabled: !paused,
  });

  const state: ConnectionState = query.isError ? "error" : query.isPending ? "connecting" : "connected";

  return {
    ...query,
    network,
    state,
    chainIdMismatch: findChainIdMismatch(network.chainId, query.data?.chainId),
  };
}
