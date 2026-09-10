import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSdk } from "./sdk-context";
import { scanActivity, type ActivityScan } from "./favorite-activity";

/**
 * When each package was last touched on the active chain.
 *
 * Both queries use the keys their own apps already use — `recent-events` is
 * the Event Explorer's and Browser home's, `indexer-transactions` is the
 * Transactions app's — so a home screen with favourites costs no requests
 * that were not already going to be made.
 *
 * Windowed by construction, which is why `oldestScanned` comes back with the
 * data. See favorite-activity.ts for why both sources are needed rather than
 * either alone.
 * @returns {object} the scan, plus enough state to say why it is empty
 */
export function useFavoriteActivity(): ActivityScan & {
  /** Whether there is a COMPLETE scan to report.
   *
   * Returned from here rather than left to each call site to derive, because
   * the two consumers derived it differently and contradicted each other: the
   * rows waited for both queries while the caption only checked that some data
   * had arrived, so on a busy chain (events resolve first) the caption
   * announced a scan window above rows showing nothing. One flag, one answer.
   *
   * Both sources are needed before anything is said: a partial scan would
   * show "quiet" for a realm the pending query is about to report as active. */
  scanned: boolean;
  indexerConfigured: boolean;
} {
  const sdk = useSdk();
  const network = sdk.networks.getActive();
  const indexerConfigured = !!network.indexerGraphqlUrl;

  const transactions = useQuery({
    queryKey: ["indexer-transactions", network.id],
    queryFn: () => sdk.indexer.listTransactions(),
    enabled: indexerConfigured,
  });
  const events = useQuery({
    queryKey: ["recent-events", network.id],
    queryFn: async () => (await sdk.indexer.recentEvents()).data,
    enabled: indexerConfigured,
  });

  // Errors are deliberately not surfaced. This annotates a list that is
  // perfectly usable without it — a favourite still opens — so a failed scan
  // should quietly show no annotation rather than put an error banner over
  // somebody's bookmarks. The apps these queries belong to report their own.
  const scan = useMemo(
    () => scanActivity(transactions.data?.data ?? [], events.data ?? []),
    [transactions.data, events.data]
  );

  return {
    ...scan,
    scanned: indexerConfigured && !transactions.isPending && !events.isPending,
    indexerConfigured,
  };
}
