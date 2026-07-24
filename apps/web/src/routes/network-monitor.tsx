import { useNetworkStatus } from "../shell/use-network-status";
import { Freshness } from "../shell/freshness";
import { openRef } from "../shell/open-ref";

export function NetworkMonitor() {
  const { data, error, isPending, network, dataUpdatedAt } = useNetworkStatus();

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
    <>
      <Freshness dataUpdatedAt={dataUpdatedAt} />
      <dl className="account-fields">
        <dt>Chain ID</dt>
        <dd>{data.chainId}</dd>
        <dt>Latest height</dt>
        <dd>
          <button
            type="button"
            className="network-monitor__height-link"
            onClick={() => openRef(`gno://_/block/${data.latestHeight}`)}
          >
            #{data.latestHeight}
          </button>
        </dd>
        <dt>RPC latency</dt>
        <dd>{data.latencyMs}ms</dd>
        <dt>RPC endpoint</dt>
        <dd>{network.rpcUrl}</dd>
        <dt>Trust</dt>
        <dd>{network.trust}</dd>
        <dt>Persistence</dt>
        <dd>{network.persistence}</dd>
      </dl>
    </>
  );
}
