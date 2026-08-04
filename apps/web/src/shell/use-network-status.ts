import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useSdk } from "../sdk-context";
import { useLiveUpdatesPaused } from "./live-updates-store";
import type { NetworkConfig } from "@gnomputer/app-sdk";

export type ConnectionState = "connecting" | "connected" | "error";

interface NetworkStatusData {
  chainId: string;
  latestHeight: number;
  latencyMs: number;
}

export function useNetworkStatus(): UseQueryResult<NetworkStatusData> & {
  network: NetworkConfig;
  state: ConnectionState;
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

  return { ...query, network, state };
}
