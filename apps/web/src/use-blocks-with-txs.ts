import { useQueries, useQuery } from "@tanstack/react-query";
import { useSdk } from "./sdk-context";
import { MAX_BLOCKS_SHOWN } from "./use-live-activity";
import type { BlockSummary } from "@gnomputer/app-sdk";

/** The most recent blocks that actually contain transactions.
 *
 * "Only with txs" used to filter the live feed, which cannot answer the
 * question on a quiet chain: measured on Topaz, none of the last 40 blocks
 * held a transaction and the most recent one that did was 554 blocks behind
 * the tip. So the filter returned nothing, every time, and looked broken
 * rather than empty.
 *
 * The indexer knows which heights have transactions, so this asks it and
 * then fetches those block summaries over RPC. Scanning backwards over RPC
 * instead would have meant hundreds of round-trips to find one block.
 *
 * Each summary is its own query so it shares react-query's cache with the
 * detail pane and the live feed — clicking a result you already have costs
 * nothing.
 */
export function useBlocksWithTxs(enabled: boolean): {
  blocks: BlockSummary[];
  isPending: boolean;
  error: unknown;
  indexerConfigured: boolean;
  retry: () => void;
} {
  const sdk = useSdk();
  const network = sdk.networks.getActive();
  const indexerConfigured = !!network.indexerGraphqlUrl;
  const active = enabled && indexerConfigured;

  const {
    data: heights,
    isPending: heightsPending,
    error,
    refetch,
  } = useQuery({
    queryKey: ["block-heights-with-txs", network.id, MAX_BLOCKS_SHOWN],
    queryFn: async () => (await sdk.indexer.blockHeightsWithTxs(MAX_BLOCKS_SHOWN)).data,
    enabled: active,
    // The answer changes only when a transaction lands, which on these
    // chains is minutes apart. Re-asking on every toggle of a checkbox
    // would re-download the height list for nothing.
    staleTime: 60_000,
  });

  const summaries = useQueries({
    queries: (heights ?? []).map((height) => ({
      // Deliberately the same key the detail pane uses, so the two share
      // one fetch per block.
      queryKey: ["block-detail", network.id, height],
      queryFn: async () => (await sdk.rpc.getBlockSummary(height)).data,
      enabled: active,
    })),
  });

  const blocks = summaries
    .map((q) => q.data)
    .filter((b): b is BlockSummary => b !== undefined)
    .sort((a, b) => b.height - a.height);

  return {
    blocks,
    // Pending while the heights are loading, or while none of the summaries
    // have arrived yet but some are expected — otherwise the caller paints
    // "nothing found" over a list that is about to appear.
    isPending: active && (heightsPending || (blocks.length === 0 && (heights ?? []).length > 0)),
    error,
    indexerConfigured,
    // Retrying the height list is what matters: the per-block summaries are
    // driven off it, and a failure here means the indexer did not answer.
    retry: () => void refetch(),
  };
}
