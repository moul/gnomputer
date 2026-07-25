import { useQuery } from "@tanstack/react-query";
import { useSdk } from "../sdk-context";

/** Address autocomplete candidates, sourced from the indexer's real recent
 * activity (top callers and deployers — see sdk.indexer.chainActivityStats)
 * rather than a dedicated "list addresses" query, since the schema has no
 * such field. Shares the same query key as the Chain Stats app, so opening
 * this after visiting Chain Stats is instant (already cached). Falls back
 * to no suggestions on networks with no indexer configured — there's no
 * other source of "real addresses that have done something" available. */
export function useAddressSuggestions(active: boolean, query = ""): string[] {
  const sdk = useSdk();
  const networkId = sdk.networks.getActive().id;
  const indexerConfigured = !!sdk.networks.getActive().indexerGraphqlUrl;

  const { data: stats } = useQuery({
    queryKey: ["chain-activity-stats", networkId],
    queryFn: async () => (await sdk.indexer.chainActivityStats()).data,
    enabled: active && indexerConfigured,
  });

  const trimmedQuery = query.trim().toLowerCase();
  if (trimmedQuery === "" || !stats) return [];

  const seen = new Set<string>();
  const matches: string[] = [];
  for (const { address } of [...stats.topCallers, ...stats.topDeployers]) {
    if (seen.has(address) || !address.toLowerCase().includes(trimmedQuery)) continue;
    seen.add(address);
    matches.push(address);
  }
  return matches;
}
