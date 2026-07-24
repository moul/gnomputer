import { useQuery } from "@tanstack/react-query";
import { useSdk } from "../sdk-context";
import { Freshness } from "../shell/freshness";
import { ErrorState } from "../shell/error-state";

// The exact ABCI call and raw response text behind the Render lens — "Raw"
// exists specifically so nothing is hidden behind an interpreted view.
export function RealmRaw({ packagePath, renderPath }: { packagePath: string; renderPath: string }) {
  const sdk = useSdk();
  const networkId = sdk.networks.getActive().id;

  const {
    data: raw,
    error,
    isPending,
    dataUpdatedAt,
    refetch,
  } = useQuery({
    queryKey: ["realm-render-raw", networkId, packagePath, renderPath],
    queryFn: async () => {
      const env = await sdk.rpc.queryRender(packagePath, renderPath, new Date().toISOString());
      return env.data;
    },
  });

  if (error) {
    return (
      <ErrorState
        message={`Could not load the raw response: ${error.message}`}
        onRetry={() => void refetch()}
      />
    );
  }
  if (isPending) {
    return (
      <p className="state-line" aria-busy="true">
        Loading raw response…
      </p>
    );
  }

  return (
    <div className="realm-raw">
      <Freshness dataUpdatedAt={dataUpdatedAt} />
      <dl className="account-fields">
        <dt>Method</dt>
        <dd>vm/qrender</dd>
        <dt>Query</dt>
        <dd>
          {packagePath}:{renderPath}
        </dd>
      </dl>
      <pre className="realm-raw__body">{raw}</pre>
    </div>
  );
}
