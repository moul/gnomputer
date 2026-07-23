import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useSdk } from "../sdk-context";
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

  const query = useQuery({
    queryKey: ["network-status", network.id],
    queryFn: async () => {
      const start = performance.now();
      const env = await sdk.rpc.getStatus();
      const latencyMs = Math.round(performance.now() - start);
      return { ...env.data, latencyMs };
    },
    refetchInterval: 5000,
  });

  const state: ConnectionState = query.isError ? "error" : query.isPending ? "connecting" : "connected";

  return { ...query, network, state };
}
