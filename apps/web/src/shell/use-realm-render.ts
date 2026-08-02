import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { RenderNode } from "@gnomputer/lenses";
import { useSdk } from "../sdk-context";

export interface RealmRenderResult {
  nodes: RenderNode[];
  loadMs: number;
}

/** The realm's `Render()` output, fetched once per realm+path.
 *
 * There were two queries doing this: the URL bar ran a `realm-exists` check
 * to decide whether the committed path resolves, and the Render lens fetched
 * the same thing to display it. Different query keys, identical request — so
 * opening a realm on the Render lens made the same call twice (AUD-026).
 *
 * Defining the key and the fetcher in one place is what makes react-query
 * dedupe them. Two callers with the same key but different options is a
 * footgun — whichever mounts first wins — so neither caller gets to pass
 * any.
 *
 * `retry: false` is deliberate. The dominant failure here is a path or realm
 * that does not exist, where retrying three times only delays a certain
 * answer by several seconds. It is also what the URL bar's check already
 * did, so this keeps the faster of the two behaviours rather than the
 * slower. */
export function useRealmRender(
  packagePath: string,
  renderPath: string,
  enabled = true
): UseQueryResult<RealmRenderResult> {
  const sdk = useSdk();
  const networkId = sdk.networks.getActive().id;

  return useQuery({
    queryKey: ["realm-render", networkId, packagePath, renderPath],
    queryFn: async () => {
      const start = performance.now();
      const env = await sdk.rpc.queryRender(packagePath, renderPath, new Date().toISOString());
      return {
        nodes: sdk.lenses.parseRender(env.data, packagePath),
        loadMs: Math.round(performance.now() - start),
      };
    },
    enabled: enabled && packagePath !== "",
    retry: false,
  });
}
