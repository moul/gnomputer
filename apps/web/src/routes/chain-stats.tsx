import { useQuery } from "@tanstack/react-query";
import { useSdk } from "../sdk-context";
import { Freshness } from "../shell/freshness";
import { ErrorState } from "../shell/error-state";
import { openRef } from "../shell/open-ref";
import { formatNumber, formatGnotAmount } from "../format-number";

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
      #{formatNumber(height)}
    </button>
  );
}

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="chain-stats__tile">
      <span className="chain-stats__tile-value">{value}</span>
      <span className="chain-stats__tile-label">{label}</span>
    </div>
  );
}

const CHART_HEIGHT = 60;
const CHART_BAR_GAP = 2;
// A day with real but small activity (e.g. 1 tx) would otherwise render as
// a near-invisible sliver next to a busy day with 100+ — flooring every
// non-zero bar to at least this fraction of the chart height keeps every
// day visibly a bar, not a hairline.
const MIN_BAR_HEIGHT_RATIO = 0.08;

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
  const minBarHeight = CHART_HEIGHT * MIN_BAR_HEIGHT_RATIO;

  return (
    <div className="chain-stats__chart">
      <p className="chain-stats__chart-label">{label}</p>
      <svg viewBox={`0 0 100 ${CHART_HEIGHT}`} preserveAspectRatio="none" className="chain-stats__chart-svg">
        <line
          x1="0"
          y1={CHART_HEIGHT - 0.5}
          x2="100"
          y2={CHART_HEIGHT - 0.5}
          className="chain-stats__chart-baseline"
        />
        {data.map((d, i) => {
          const value = pick(d);
          const rawHeight = (value / max) * (CHART_HEIGHT - 4);
          const barHeight = value > 0 ? Math.max(rawHeight, minBarHeight) : 0;
          return (
            <rect
              key={d.date}
              x={i * barWidth + CHART_BAR_GAP / 2}
              y={CHART_HEIGHT - barHeight}
              width={Math.max(0, barWidth - CHART_BAR_GAP)}
              height={barHeight}
              rx="1"
              className="chain-stats__chart-bar"
            >
              <title>
                {d.date}: {formatNumber(value)}
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
    data: daysEnvelope,
    error,
    isPending,
    refetch,
  } = useQuery({
    queryKey: ["daily-activity", networkId],
    queryFn: () => sdk.indexer.dailyActivity(),
    // The indexer scans the block range server-side, so this is genuinely
    // slow — measured at 30s against Topaz for a five-day window. Daily
    // buckets do not change meaningfully within an hour, and paying 30s
    // again on a window focus would be absurd.
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });

  if (error) {
    return (
      <ErrorState message="Could not load daily activity" error={error} onRetry={() => void refetch()} />
    );
  }
  if (isPending) {
    return (
      <p className="state-line" aria-busy="true">
        Loading daily activity — the indexer scans the block range for this, which
        takes around half a minute. It is then cached for an hour.
      </p>
    );
  }
  const days = daysEnvelope.data;
  if (days.length === 0) {
    return <p className="state-line">No historical block data found.</p>;
  }

  // One day is not a trend, and drawing it as a chart draws a single bar
  // filling the full width — which reads as a broken chart rather than as a
  // chain that is a few hours old. Pearl looked exactly like that on the day
  // it became the default. State the numbers instead; the chart comes back on
  // its own as soon as there is a second day to compare against.
  if (days.length === 1) {
    const only = days[0]!;
    return (
      <section className="chain-stats__section">
        <h3>Daily activity ({only.date})</h3>
        <p className="state-line">
          One day of history so far — {formatNumber(only.blockCount)}{" "}
          {only.blockCount === 1 ? "block" : "blocks"} with activity and{" "}
          {formatNumber(only.txCount)} {only.txCount === 1 ? "transaction" : "transactions"}. A
          day-by-day chart appears once there is more than one day to compare.
        </p>
      </section>
    );
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

// Aggregated from the successful transactions in a recent window of blocks,
// not from all of history: an unbounded scan hits the indexer's
// ten-thousand-element cap and fails outright, which is what left this app on
// "Loading chain activity stats…" forever (indexer-backed
// — see sdk.indexer.chainActivityStats / rpc/src/indexer.ts's
// chainActivityStats for the exact attribution rules, e.g. a multi-message
// tx's gas counts toward every realm it touched, same tradeoff mygnoscan's
// own /gas and /analytics pages make).
export function ChainStats() {
  const sdk = useSdk();
  const networkId = sdk.networks.getActive().id;
  const indexerConfigured = !!sdk.networks.getActive().indexerGraphqlUrl;

  const {
    data: statsEnvelope,
    error,
    isPending,
    dataUpdatedAt,
    refetch,
  } = useQuery({
    queryKey: ["chain-activity-stats", networkId],
    // The whole envelope, not just .data: Freshness reports where the
    // data came from, and that must come from the adapter rather than from
    // this call site's assumption about it.
    queryFn: () => sdk.indexer.chainActivityStats(),
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
      <ErrorState message="Could not load chain stats" error={error} onRetry={() => void refetch()} />
    );
  }
  if (isPending) {
    return (
      <p className="state-line" aria-busy="true">
        Loading chain activity stats…
      </p>
    );
  }

  const stats = statsEnvelope.data;
  const avgGasPerTx = stats.totalTxs > 0 ? Math.round(stats.totalGasUsed / stats.totalTxs) : 0;

  return (
    <div className="chain-stats">
      <Freshness dataUpdatedAt={dataUpdatedAt} source={statsEnvelope.source} />

      <div className="chain-stats__tiles">
        <StatTile value={formatNumber(stats.totalTxs)} label="transactions" />
        <StatTile value={formatNumber(stats.totalCalls)} label="calls" />
        <StatTile value={formatNumber(stats.totalDeploys)} label="deploys" />
        <StatTile value={formatNumber(stats.totalRuns)} label="runs" />
        <StatTile value={formatNumber(stats.totalSends)} label="sends" />
        <StatTile value={formatNumber(stats.totalGasUsed)} label="total gas used" />
        <StatTile value={formatGnotAmount(stats.totalFeeUgnot)} label="total fees" />
        <StatTile value={formatNumber(avgGasPerTx)} label="avg gas / tx" />
      </div>

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
                  {formatNumber(r.gasUsed)} gas · {r.txCount} {r.txCount === 1 ? "tx" : "txs"}
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
                  {formatNumber(tx.gasUsed)} gas · {formatGnotAmount(tx.feeUgnot)}
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
