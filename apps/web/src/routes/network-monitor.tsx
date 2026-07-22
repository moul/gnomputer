import { useQuery } from "@tanstack/react-query";
import { useSdk } from "../sdk-context";

export function NetworkMonitor() {
  const sdk = useSdk();
  const network = sdk.networks.getActive();

  const { data, error, isPending } = useQuery({
    queryKey: ["network-status", network.id],
    queryFn: async () => {
      const start = performance.now();
      const env = await sdk.rpc.getStatus();
      const latencyMs = Math.round(performance.now() - start);
      return { ...env.data, latencyMs };
    },
    refetchInterval: 5000,
  });

  if (error) {
    return (
      <p className="state-line" role="alert">
        Could not reach {network.name}: {error.message}
      </p>
    );
  }
  if (isPending) {
    return (
      <p className="state-line" aria-busy="true">
        Checking network health…
      </p>
    );
  }

  return (
    <dl className="account-fields">
      <dt>Chain ID</dt>
      <dd>{data.chainId}</dd>
      <dt>Latest height</dt>
      <dd>#{data.latestHeight}</dd>
      <dt>RPC latency</dt>
      <dd>{data.latencyMs}ms</dd>
      <dt>RPC endpoint</dt>
      <dd>{network.rpcUrl}</dd>
      <dt>Trust</dt>
      <dd>{network.trust}</dd>
      <dt>Persistence</dt>
      <dd>{network.persistence}</dd>
    </dl>
  );
}
