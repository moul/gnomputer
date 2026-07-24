import { useQuery } from "@tanstack/react-query";
import { useNetworkStatus } from "../shell/use-network-status";
import { useSdk } from "../sdk-context";
import { Freshness } from "../shell/freshness";
import { ErrorState } from "../shell/error-state";

// A lightweight, embedded slice of what the real Gnockpit dashboard shows
// (chain identity + validator set summary), backed by the same RPC calls the
// rest of the app already uses — plus a link out to the real instance for
// everything this mini-view doesn't attempt to replicate (gas trends,
// mempool, per-block explorer, etc).
export function Gnockpit() {
  const sdk = useSdk();
  const networkId = sdk.networks.getActive().id;
  const network = sdk.networks.getActive();
  const status = useNetworkStatus();

  const validators = useQuery({
    queryKey: ["validator-set", networkId],
    queryFn: async () => {
      const env = await sdk.rpc.getValidatorSet(new Date().toISOString());
      return env.data;
    },
  });

  if (status.error) {
    return (
      <ErrorState
        message={`Could not reach ${network.name}: ${status.error.message}`}
        onRetry={() => void status.refetch()}
      />
    );
  }
  if (status.isPending) {
    return (
      <p className="state-line" aria-busy="true">
        Checking network health…
      </p>
    );
  }

  const totalPower = validators.data
    ? validators.data.validators.reduce((sum, v) => sum + Number(v.votingPower), 0)
    : null;

  return (
    <div className="gnockpit">
      <Freshness dataUpdatedAt={status.dataUpdatedAt} />
      <dl className="account-fields">
        <dt>Chain ID</dt>
        <dd>{status.data.chainId}</dd>
        <dt>Latest height</dt>
        <dd>#{status.data.latestHeight.toLocaleString()}</dd>
        <dt>RPC latency</dt>
        <dd>{status.data.latencyMs}ms</dd>
        <dt>Validators</dt>
        <dd>
          {validators.isPending
            ? "Loading…"
            : validators.error
              ? "Not available"
              : `${validators.data.validators.length} · ${totalPower!.toLocaleString()} total voting power`}
        </dd>
      </dl>
      {network.gnockpitUrl ? (
        <a className="gnockpit__link" href={network.gnockpitUrl} target="_blank" rel="noreferrer">
          Open Gnockpit ↗
        </a>
      ) : (
        <p className="state-line">No Gnockpit instance configured for {network.name}.</p>
      )}
    </div>
  );
}
