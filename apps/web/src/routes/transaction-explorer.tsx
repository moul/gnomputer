import { useState } from "react";
import { useLiveTransactions } from "../use-live-transactions";
import { openRef } from "../shell/open-ref";

type SortKey = "height" | "gasUsed";
type SortDir = "asc" | "desc";

export function TransactionExplorer() {
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("height");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const { transactions } = useLiveTransactions(paused);

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
  const filtered = needle
    ? transactions.filter((tx) => tx.pkgPaths.some((p) => p.toLowerCase().includes(needle)))
    : transactions;
  const sorted = [...filtered].sort((a, b) => {
    const cmp = sortKey === "height" ? a.height - b.height || a.txIndex - b.txIndex : a.gasUsed - b.gasUsed;
    return sortDir === "asc" ? cmp : -cmp;
  });

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
      {sorted.length === 0 ? (
        <p className="state-line" aria-busy="true">
          Watching the chain for transactions…
        </p>
      ) : (
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
                    #{tx.height.toLocaleString()}
                    <span className="transaction-explorer__tx-index">.{tx.txIndex}</span>
                  </button>
                </td>
                <td>
                  <span className={`transaction-explorer__status ${tx.success ? "is-ok" : "is-error"}`}>
                    {tx.success ? "✓ ok" : "✗ failed"}
                  </span>
                </td>
                <td className="transaction-explorer__pkgs">
                  {tx.pkgPaths.length === 0 ? "—" : tx.pkgPaths.join(", ")}
                </td>
                <td>
                  {tx.gasUsed.toLocaleString()} / {tx.gasWanted.toLocaleString()}
                </td>
                <td>{tx.eventCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="state-line">
        Ranked from live blocks seen since this window opened — not a historical or complete
        list, which would need the indexer. For a live per-event feed instead, see Network →
        Event Explorer.
      </p>
    </div>
  );
}
