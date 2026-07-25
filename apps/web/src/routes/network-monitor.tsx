import { useNetworkStatus } from "../shell/use-network-status";
import { Freshness } from "../shell/freshness";
import { openRef } from "../shell/open-ref";
import { openExplorer } from "../shell/open-explorer";
import { ErrorState } from "../shell/error-state";

export function NetworkMonitor() {
  const { data, error, isPending, network, dataUpdatedAt, refetch } = useNetworkStatus();

  if (error) {
    return (
      <ErrorState message={`Could not reach ${network.name}: ${error.message}`} onRetry={() => void refetch()} />
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
            onClick={(e) => openRef(`gno://_/block/${data.latestHeight}`, { x: e.clientX, y: e.clientY })}
          >
            #{data.latestHeight.toLocaleString()}
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
      {(network.explorerUrl || network.statusUrl) && (
        <p className="network-monitor__external-links">
          {network.explorerUrl && (
            <button type="button" onClick={() => openExplorer(network.explorerUrl as string)}>
              Open the explorer
            </button>
          )}
          {network.statusUrl && (
            <a
              className="realm-browser__gnoweb-link"
              href={network.statusUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Status page ↗
            </a>
          )}
        </p>
      )}
    </>
  );
}
