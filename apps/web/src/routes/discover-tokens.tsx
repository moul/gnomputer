import { useQuery } from "@tanstack/react-query";
import { useSdk } from "../sdk-context";
import { ErrorState } from "../shell/error-state";
import { RenderNodeView } from "../shell/render-node-view";

// The only real GRC20 token registry confirmed live on gno.land testnets —
// its own Render() lists every registered token (name, symbol, realm,
// decimals, supply) with working links to each token's own info page.
// There's no per-holder breakdown available here (or anywhere reachable
// without the indexer) — this shows what the registry itself exposes, not
// a hand-built table, so it stays accurate as tokens are added.
const GRC20_REGISTRY_PATH = "gno.land/r/demo/defi/grc20reg";

export function DiscoverTokens() {
  const sdk = useSdk();
  const networkId = sdk.networks.getActive().id;

  const {
    data: nodes,
    error,
    isPending,
    refetch,
  } = useQuery({
    queryKey: ["grc20-registry", networkId],
    queryFn: async () => {
      const env = await sdk.rpc.queryRender(GRC20_REGISTRY_PATH, "", new Date().toISOString());
      return sdk.lenses.parseRender(env.data, GRC20_REGISTRY_PATH);
    },
  });

  if (error) {
    return (
      <ErrorState
        message="Could not load the token registry" error={error}
        onRetry={() => void refetch()}
      />
    );
  }
  if (isPending || !nodes) {
    return (
      <p className="state-line" aria-busy="true">
        Loading tokens…
      </p>
    );
  }

  return (
    <div className="discover-tokens">
      <p className="state-line">
        Native GNOT plus every GRC20 token registered on {GRC20_REGISTRY_PATH}.
      </p>
      <dl className="account-fields">
        <dt>Native</dt>
        <dd>GNOT (ugnot, 6 decimals)</dd>
      </dl>
      <div className="discover-tokens__render">
        {nodes.map((node, i) => (
          <RenderNodeView key={i} node={node} windowId="realm" />
        ))}
      </div>
    </div>
  );
}
