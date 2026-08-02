import { useQuery } from "@tanstack/react-query";
import { useSdk } from "../sdk-context";
import { ErrorState } from "../shell/error-state";
import { RenderNodeView } from "../shell/render-node-view";

const GOVDAO_PATH = "gno.land/r/gov/dao";

export function DiscoverGovernance() {
  const sdk = useSdk();
  const networkId = sdk.networks.getActive().id;

  const {
    data: nodes,
    error,
    isPending,
    refetch,
  } = useQuery({
    queryKey: ["govdao-render", networkId],
    queryFn: async () => {
      const env = await sdk.rpc.queryRender(GOVDAO_PATH, "", new Date().toISOString());
      return sdk.lenses.parseRender(env.data, GOVDAO_PATH);
    },
  });

  if (error) {
    return (
      <ErrorState
        message="Could not load governance proposals" error={error}
        onRetry={() => void refetch()}
      />
    );
  }
  if (isPending || !nodes) {
    return (
      <p className="state-line" aria-busy="true">
        Loading proposals…
      </p>
    );
  }

  return (
    <div className="discover-governance">
      <div className="discover-governance__render">
        {nodes.map((node, i) => (
          <RenderNodeView key={i} node={node} windowId="realm" />
        ))}
      </div>
    </div>
  );
}
