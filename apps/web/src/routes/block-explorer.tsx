import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSdk } from "../sdk-context";
import { useTrailRecorder } from "../use-trail-recorder";
import { usePendingRefsStore } from "../shell/pending-refs-store";
import { useNetworkStatus } from "../shell/use-network-status";
import { useLiveActivity } from "../use-live-activity";
import { formatTimeAgo } from "../format-time-ago";
import { Linkified } from "../shell/linkify";
import { Freshness } from "../shell/freshness";
import { ErrorState } from "../shell/error-state";
import { openEmbed } from "../shell/open-embed";
import { BlockStrip } from "./block-strip";

// Trail a couple of blocks behind the chain tip — the very latest block can
// briefly 404 against getBlockSummary before it's fully indexed.
const LATEST_SAFETY_MARGIN = 2;

export function BlockExplorer() {
  const sdk = useSdk();
  const networkId = sdk.networks.getActive().id;
  const explorerUrl = sdk.networks.getActive().explorerUrl;
  const [draftHeight, setDraftHeight] = useState("");
  const [height, setHeight] = useState<number | null>(null);
  const [latest, setLatest] = useState(true);
  const pendingHeight = usePendingRefsStore((s) => s.pendingBlockHeight);
  const { data: status } = useNetworkStatus();

  const [paused, setPaused] = useState(false);
  const [txsOnly, setTxsOnly] = useState(false);
  const { blocks } = useLiveActivity(paused);
  const [now, setNow] = useState(() => Date.now());
  const warnings = sdk.networks.getActive().warnings ?? [];

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!latest || !status) return;
    const target = status.latestHeight - LATEST_SAFETY_MARGIN;
    setHeight(target);
    setDraftHeight(String(target));
  }, [latest, status]);

  useEffect(() => {
    if (pendingHeight === null) return;
    setLatest(false);
    setHeight(pendingHeight);
    setDraftHeight(String(pendingHeight));
    usePendingRefsStore.getState().setPendingBlockHeight(null);
  }, [pendingHeight]);

  useTrailRecorder({
    uri: `gno://${networkId}/block/${height ?? ""}`,
    label: height !== null ? `Block #${height.toLocaleString()}` : "Block Explorer",
  });

  const {
    data: block,
    error,
    isPending,
    dataUpdatedAt,
    refetch,
  } = useQuery({
    queryKey: ["block-detail", networkId, height],
    queryFn: async () => {
      const env = await sdk.rpc.getBlockSummary(height!);
      return env.data;
    },
    enabled: height !== null,
  });

  const { data: blockEvents } = useQuery({
    queryKey: ["block-events", networkId, height],
    queryFn: async () => {
      const env = await sdk.rpc.getBlockEvents(height!, new Date().toISOString());
      return env.data;
    },
    enabled: height !== null && !!block && block.numTxs > 0,
  });

  function selectBlock(h: number) {
    setLatest(false);
    setHeight(h);
    setDraftHeight(String(h));
  }

  const visibleBlocks = txsOnly ? blocks.filter((b) => b.numTxs > 0) : blocks;

  return (
    <div className="block-explorer">
      <div className="block-explorer__layout">
        <div className="recent-activity block-explorer__list-pane">
          <BlockStrip blocks={blocks} selectedHeight={height} onSelect={selectBlock} />
          <div className="recent-activity__toolbar">
            <label className="recent-activity__filter">
              <input type="checkbox" checked={txsOnly} onChange={(e) => setTxsOnly(e.target.checked)} />
              Only with txs
            </label>
            <button type="button" onClick={() => setPaused((p) => !p)}>
              {paused ? "▶ Resume" : "⏸ Pause"}
            </button>
          </div>
          {warnings.length > 0 && (
            <p className="panel__notice">{warnings.map((w) => w.message).join(" ")}</p>
          )}
          {blocks.length === 0 ? (
            <p className="state-line" aria-busy="true">
              Watching the chain for new blocks…
            </p>
          ) : visibleBlocks.length === 0 ? (
            <p className="state-line">No blocks with transactions in the current window yet.</p>
          ) : (
            <ul className="activity-list">
              {visibleBlocks.map((b) => (
                <li
                  key={b.height}
                  className="activity-list__row"
                  data-active={b.height === height}
                >
                  <button
                    type="button"
                    className="activity-list__height"
                    onClick={() => selectBlock(b.height)}
                  >
                    #{b.height.toLocaleString()}
                  </button>
                  <span className="activity-list__txs">
                    {b.numTxs} {b.numTxs === 1 ? "transaction" : "transactions"}
                  </span>
                  <span className="activity-list__time">{formatTimeAgo(b.time, now)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="block-explorer__detail-pane">
          <form
            className="open-package-form"
            onSubmit={(e) => {
              e.preventDefault();
              const parsed = Number(draftHeight);
              if (Number.isFinite(parsed) && parsed > 0) {
                setLatest(false);
                setHeight(parsed);
              }
            }}
          >
            <label>
              Block height
              <input
                type="text"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-1p-ignore="true"
                data-lpignore="true"
                data-bwignore="true"
                value={draftHeight}
                onChange={(e) => setDraftHeight(e.target.value)}
                disabled={latest}
                inputMode="numeric"
              />
            </label>
            <button type="submit" disabled={latest}>
              Open
            </button>
            <button
              type="button"
              data-active={latest}
              className="block-explorer__latest-toggle"
              onClick={() => setLatest((l) => !l)}
            >
              {latest ? "● Latest" : "○ Latest"}
            </button>
            {explorerUrl && (
              <button type="button" onClick={() => openEmbed(explorerUrl, "Explorer")}>
                Open the explorer
              </button>
            )}
          </form>

          {error ? (
            <ErrorState
              message={`Could not load block #${height}: ${error.message}`}
              onRetry={() => void refetch()}
            />
          ) : isPending || !block ? (
            <p className="state-line" aria-busy="true">
              Loading block…
            </p>
          ) : (
            <>
              <Freshness dataUpdatedAt={dataUpdatedAt} />
              <dl className="account-fields">
                <dt>Height</dt>
                <dd>#{block.height.toLocaleString()}</dd>
                <dt>Time</dt>
                <dd>{block.time}</dd>
                <dt>Transactions</dt>
                <dd>
                  {block.numTxs} (chain total: {block.totalTxs.toLocaleString()})
                </dd>
                <dt>Proposer</dt>
                <dd>
                  <Linkified text={block.proposerAddress} />
                </dd>
                <dt>Version</dt>
                <dd>
                  {block.version}
                  {block.appVersion ? ` / app ${block.appVersion}` : ""}
                </dd>
                <dt>Data hash</dt>
                <dd>{block.dataHashHex || "(empty — no transactions in this block)"}</dd>
                <dt>Validators hash</dt>
                <dd>{block.validatorsHashHex || "(empty)"}</dd>
              </dl>
              {block.numTxs > 0 && (
                <ul className="event-list block-explorer__txs">
                  {blockEvents
                    ? blockEvents.txs.map((tx) => (
                        <li key={tx.txIndex} className="event-list__row">
                          <div className="event-list__head">
                            <span className="event-list__type">
                              Tx #{tx.txIndex} · {tx.success ? "success" : "failed"}
                            </span>
                            <span className="event-list__pkg">
                              gas {tx.gasUsed.toLocaleString()} / {tx.gasWanted.toLocaleString()}
                            </span>
                          </div>
                          {tx.events.length > 0 && (
                            <dl className="event-list__attrs">
                              <span className="event-list__attr">
                                <dt>events</dt>
                                <dd>
                                  {tx.events.length} ({tx.events.map((e) => e.type).join(", ")})
                                </dd>
                              </span>
                            </dl>
                          )}
                        </li>
                      ))
                    : (
                        <li className="state-line" aria-busy="true">
                          Loading transactions…
                        </li>
                      )}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
