import { useQuery } from "@tanstack/react-query";
import { useSdk } from "../sdk-context";
import { Freshness } from "../shell/freshness";
import { ErrorState } from "../shell/error-state";
import { openRef } from "../shell/open-ref";

function formatGnot(amountUgnot: number): string {
  return `${(amountUgnot / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 6 })} GNOT`;
}

function RealmLink({ packagePath }: { packagePath: string }) {
  return (
    <button
      type="button"
      className="chain-stats__link"
      onClick={(e) => openRef(`gno://_/realm/${packagePath}`, { x: e.clientX, y: e.clientY })}
    >
      {packagePath}
    </button>
  );
}

function AddressLink({ address }: { address: string }) {
  return (
    <button
      type="button"
      className="chain-stats__link"
      onClick={(e) => openRef(`gno://_/address/${address}`, { x: e.clientX, y: e.clientY })}
    >
      {address}
    </button>
  );
}

function BlockLink({ height }: { height: number }) {
  return (
    <button
      type="button"
      className="chain-stats__link"
      onClick={(e) => openRef(`gno://_/block/${height}`, { x: e.clientX, y: e.clientY })}
    >
      #{height.toLocaleString()}
    </button>
  );
}

const CHART_HEIGHT = 60;
const CHART_BAR_GAP = 2;

// A plain hand-rolled SVG bar chart rather than pulling in a charting
// library — two small bars per day (blocks, txs) is well within what a
// few dozen <rect>s can do without any new dependency.
function DailyBarChart({
  data,
  pick,
  label,
}: {
  data: { date: string; blockCount: number; txCount: number }[];
  pick: (d: { date: string; blockCount: number; txCount: number }) => number;
  label: string;
}) {
  const max = Math.max(1, ...data.map(pick));
  const barWidth = data.length > 0 ? 100 / data.length : 100;

  return (
    <div className="chain-stats__chart">
      <p className="chain-stats__chart-label">{label}</p>
      <svg viewBox={`0 0 100 ${CHART_HEIGHT}`} preserveAspectRatio="none" className="chain-stats__chart-svg">
        {data.map((d, i) => {
          const value = pick(d);
          const barHeight = (value / max) * (CHART_HEIGHT - 4);
          return (
            <rect
              key={d.date}
              x={i * barWidth + CHART_BAR_GAP / 2}
              y={CHART_HEIGHT - barHeight}
              width={Math.max(0, barWidth - CHART_BAR_GAP)}
              height={barHeight}
              className="chain-stats__chart-bar"
            >
              <title>
                {d.date}: {value.toLocaleString()}
              </title>
            </rect>
          );
        })}
      </svg>
    </div>
  );
}

function DailyActivitySection() {
  const sdk = useSdk();
  const networkId = sdk.networks.getActive().id;
  const {
    data: days,
    error,
    isPending,
    refetch,
  } = useQuery({
    queryKey: ["daily-activity", networkId],
    queryFn: async () => (await sdk.indexer.dailyActivity()).data,
    // The indexer scans the whole block range server-side for this one
    // (confirmed live: ~10s round trip) — this doesn't change fast enough
    // to be worth refetching on every window focus.
    staleTime: 5 * 60 * 1000,
  });

  if (error) {
    return (
      <ErrorState message={`Could not load daily activity: ${error.message}`} onRetry={() => void refetch()} />
    );
  }
  if (isPending) {
    return (
      <p className="state-line" aria-busy="true">
        Loading daily activity (this scans the full chain history, can take several seconds)…
      </p>
    );
  }
  if (days.length === 0) {
    return <p className="state-line">No historical block data found.</p>;
  }

  return (
    <section className="chain-stats__section">
      <h3>
        Daily activity ({days[0]!.date} to {days[days.length - 1]!.date})
      </h3>
      <DailyBarChart data={days} pick={(d) => d.blockCount} label="Blocks with activity / day" />
      <DailyBarChart data={days} pick={(d) => d.txCount} label="Transactions / day" />
    </section>
  );
}

// Aggregated from every successful transaction on the chain (indexer-backed
// — see sdk.indexer.chainActivityStats / rpc/src/indexer.ts's
// chainActivityStats for the exact attribution rules, e.g. a multi-message
// tx's gas counts toward every realm it touched, same tradeoff mygnoscan's
// own /gas and /analytics pages make).
export function ChainStats() {
  const sdk = useSdk();
  const networkId = sdk.networks.getActive().id;
  const indexerConfigured = !!sdk.networks.getActive().indexerGraphqlUrl;

  const {
    data: stats,
    error,
    isPending,
    dataUpdatedAt,
    refetch,
  } = useQuery({
    queryKey: ["chain-activity-stats", networkId],
    queryFn: async () => (await sdk.indexer.chainActivityStats()).data,
    enabled: indexerConfigured,
  });

  if (!indexerConfigured) {
    return (
      <p className="state-line">
        No indexer configured for {sdk.networks.getActive().name} — chain-wide gas and activity
        stats need one.
      </p>
    );
  }
  if (error) {
    return (
      <ErrorState message={`Could not load chain stats: ${error.message}`} onRetry={() => void refetch()} />
    );
  }
  if (isPending) {
    return (
      <p className="state-line" aria-busy="true">
        Loading chain activity stats…
      </p>
    );
  }

  return (
    <div className="chain-stats">
      <Freshness dataUpdatedAt={dataUpdatedAt} />
      <p className="state-line">
        {stats.totalTxs.toLocaleString()} successful transactions · {stats.totalCalls.toLocaleString()}{" "}
        calls · {stats.totalDeploys.toLocaleString()} deploys · {stats.totalRuns.toLocaleString()} runs ·{" "}
        {stats.totalSends.toLocaleString()} sends
      </p>
      <p className="state-line">
        {stats.totalGasUsed.toLocaleString()} total gas used · {formatGnot(stats.totalFeeUgnot)} total fees
        · {stats.totalTxs > 0 ? Math.round(stats.totalGasUsed / stats.totalTxs).toLocaleString() : 0} avg
        gas/tx
      </p>

      <DailyActivitySection />

      <section className="chain-stats__section">
        <h3>Top realms by gas</h3>
        {stats.topRealmsByGas.length === 0 ? (
          <p className="state-line">No data yet.</p>
        ) : (
          <ol className="chain-stats__list">
            {stats.topRealmsByGas.map((r) => (
              <li key={r.packagePath}>
                <RealmLink packagePath={r.packagePath} />
                <span className="chain-stats__value">
                  {r.gasUsed.toLocaleString()} gas · {r.txCount} {r.txCount === 1 ? "tx" : "txs"}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="chain-stats__section">
        <h3>Top transactions by gas</h3>
        {stats.topTxsByGas.length === 0 ? (
          <p className="state-line">No data yet.</p>
        ) : (
          <ol className="chain-stats__list">
            {stats.topTxsByGas.map((tx) => (
              <li key={`${tx.height}-${tx.index}`}>
                <BlockLink height={tx.height} />
                <span className="chain-stats__value">
                  {tx.gasUsed.toLocaleString()} gas · {formatGnot(tx.feeUgnot)}
                  {tx.packagePaths.length > 0 ? ` · ${tx.packagePaths.join(", ")}` : ""}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="chain-stats__section">
        <h3>Top callers</h3>
        {stats.topCallers.length === 0 ? (
          <p className="state-line">No data yet.</p>
        ) : (
          <ol className="chain-stats__list">
            {stats.topCallers.map((c) => (
              <li key={c.address}>
                <AddressLink address={c.address} />
                <span className="chain-stats__value">
                  {c.count} {c.count === 1 ? "call" : "calls"}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="chain-stats__section">
        <h3>Top deployers</h3>
        {stats.topDeployers.length === 0 ? (
          <p className="state-line">No data yet.</p>
        ) : (
          <ol className="chain-stats__list">
            {stats.topDeployers.map((d) => (
              <li key={d.address}>
                <AddressLink address={d.address} />
                <span className="chain-stats__value">
                  {d.count} {d.count === 1 ? "deploy" : "deploys"}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
