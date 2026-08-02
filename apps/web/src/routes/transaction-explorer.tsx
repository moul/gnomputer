import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSdk } from "../sdk-context";
import { useLiveTransactions } from "../use-live-transactions";
import { openRef } from "../shell/open-ref";
import { Freshness } from "../shell/freshness";
import { ErrorState } from "../shell/error-state";
import { formatNumber } from "../format-number";
import { LiveFeedStatus } from "../shell/live-feed-status";

type SortKey = "height" | "gasUsed";
type SortDir = "asc" | "desc";

interface Row {
  height: number;
  txIndex: number;
  success: boolean;
  gasUsed: number;
  gasWanted: number;
  pkgPaths: string[];
  eventCount: number;
}

function useSortedFilteredRows(rows: Row[], filter: string) {
  const [sortKey, setSortKey] = useState<SortKey>("height");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function sortIndicator(key: SortKey): string {
    if (key !== sortKey) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  const needle = filter.trim().toLowerCase();
  const filtered = needle ? rows.filter((tx) => tx.pkgPaths.some((p) => p.toLowerCase().includes(needle))) : rows;
  const sorted = [...filtered].sort((a, b) => {
    const cmp = sortKey === "height" ? a.height - b.height || a.txIndex - b.txIndex : a.gasUsed - b.gasUsed;
    return sortDir === "asc" ? cmp : -cmp;
  });

  return { sorted, toggleSort, sortIndicator };
}

function TransactionTable({
  rows,
  filter,
  // Only the live variant can be "unreachable" mid-stream; the indexer
  // variant surfaces its own errors through react-query.
  isError = false,
}: {
  rows: Row[];
  filter: string;
  isError?: boolean;
}) {
  const { sorted, toggleSort, sortIndicator } = useSortedFilteredRows(rows, filter);

  if (sorted.length === 0) {
    return (
      <LiveFeedStatus isError={isError} watching="Watching the chain for transactions…" />
    );
  }

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>
            <button type="button" onClick={() => toggleSort("height")}>
              Block{sortIndicator("height")}
            </button>
          </th>
          <th>Status</th>
          <th>Packages</th>
          <th>
            <button type="button" onClick={() => toggleSort("gasUsed")}>
              Gas used / wanted{sortIndicator("gasUsed")}
            </button>
          </th>
          <th>Events</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((tx) => (
          <tr key={`${tx.height}-${tx.txIndex}`}>
            <td>
              <button
                type="button"
                className="data-table__link"
                onClick={(e) => openRef(`gno://_/block/${tx.height}`, { x: e.clientX, y: e.clientY })}
              >
                #{formatNumber(tx.height)}
                <span className="transaction-explorer__tx-index">.{tx.txIndex}</span>
              </button>
            </td>
            <td>
              <span className={`transaction-explorer__status ${tx.success ? "is-ok" : "is-error"}`}>
                {tx.success ? "✓ ok" : "✗ failed"}
              </span>
            </td>
            <td className="transaction-explorer__pkgs">{tx.pkgPaths.length === 0 ? "—" : tx.pkgPaths.join(", ")}</td>
            <td>
              {formatNumber(tx.gasUsed)} / {formatNumber(tx.gasWanted)}
            </td>
            <td>{tx.eventCount}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Real, complete, historical transaction listing via the indexer (up to its
// 10,000-row cap — confirmed live this comfortably covers Topaz's real
// current volume: 863 transactions, both successful and failed) — not just
// what's been seen since this window opened, which is what the RPC-only
// fallback below is limited to.
function IndexerTransactionExplorer() {
  const sdk = useSdk();
  const networkId = sdk.networks.getActive().id;
  const [filter, setFilter] = useState("");

  const {
    data: transactionsEnvelope,
    error,
    isPending,
    dataUpdatedAt,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["indexer-transactions", networkId],
    queryFn: () => sdk.indexer.listTransactions(),
  });

  const transactions = transactionsEnvelope?.data;
  const rows: Row[] = (transactions ?? []).map((tx) => ({
    height: tx.height,
    txIndex: tx.txIndex,
    success: tx.success,
    gasUsed: tx.gasUsed,
    gasWanted: tx.gasWanted,
    pkgPaths: tx.packagePaths,
    eventCount: tx.eventCount,
  }));

  return (
    <div className="transaction-explorer">
      <div className="transaction-explorer__toolbar">
        <button type="button" disabled={isFetching} onClick={() => void refetch()}>
          {isFetching ? "Refreshing…" : "↻ Refresh"}
        </button>
        <input
          type="text"
          autoComplete="off"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by package…"
        />
        <span className="state-line">{formatNumber(rows.length)} total</span>
      </div>
      {error ? (
        <ErrorState message={`Could not load transactions: ${error.message}`} onRetry={() => void refetch()} />
      ) : isPending ? (
        <p className="state-line" aria-busy="true">
          Loading transaction history…
        </p>
      ) : (
        <>
          <TransactionTable rows={rows} filter={filter} />
          <Freshness dataUpdatedAt={dataUpdatedAt} source={transactionsEnvelope?.source} />
        </>
      )}
    </div>
  );
}

// Fallback for networks with no indexer configured (e.g. gnodev) — a live,
// forward-only feed polled from RPC block results, capped to what's been
// seen since this window opened.
function LiveTransactionExplorer() {
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState("");
  const { transactions, isError } = useLiveTransactions(paused);

  return (
    <div className="transaction-explorer">
      <div className="transaction-explorer__toolbar">
        <button type="button" onClick={() => setPaused((p) => !p)}>
          {paused ? "▶ Resume" : "⏸ Pause"}
        </button>
        <input
          type="text"
          autoComplete="off"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by package…"
        />
        <span className="state-line">{transactions.length} seen this session</span>
      </div>
      <TransactionTable rows={transactions} filter={filter} isError={isError} />
      <p className="state-line">
        No indexer configured for this network — showing only transactions seen live since this
        window opened, not a complete history.
      </p>
    </div>
  );
}

export function TransactionExplorer() {
  const sdk = useSdk();
  const indexerConfigured = !!sdk.networks.getActive().indexerGraphqlUrl;
  return indexerConfigured ? <IndexerTransactionExplorer /> : <LiveTransactionExplorer />;
}
