import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSdk } from "../sdk-context";
import { useTrailRecorder } from "../use-trail-recorder";
import { usePendingRefsStore } from "../shell/pending-refs-store";
import { useNetworkStatus } from "../shell/use-network-status";
import { useLiveActivity } from "../use-live-activity";
import { useBlocksWithTxs } from "../use-blocks-with-txs";
import { formatTimeAgo } from "../format-time-ago";
import { Linkified } from "../shell/linkify";
import { Freshness } from "../shell/freshness";
import { ErrorState } from "../shell/error-state";
import { openExplorer } from "../shell/open-explorer";
import { formatNumber, formatGnotAmount } from "../format-number";
import { BlockStrip } from "./block-strip";
import { LiveFeedStatus } from "../shell/live-feed-status";
import { describeTxMessage } from "../shell/describe-tx-message";
import { openInRealmTab } from "../shell/open-in-realm-tab";
import { focusOrReopen } from "../shell/open-ref";
import type { BlockTxResult, IndexerBlockTx } from "@gnomputer/app-sdk";

// Trail a couple of blocks behind the chain tip — the very latest block can
// briefly 404 against getBlockSummary before it's fully indexed.
const LATEST_SAFETY_MARGIN = 2;

/** One transaction in a block.
 *
 * Two sources, deliberately layered. `tx` is RPC `block_results` — always
 * available, authoritative for gas, success and emitted events, and
 * carrying no message bodies whatsoever. `detail` is the indexer's record
 * of what the transaction actually did, and is simply absent on a network
 * without one, which is why every part of it is guarded rather than
 * assumed. */
function BlockTxRow({ tx, detail }: { tx: BlockTxResult; detail?: IndexerBlockTx }) {
  return (
    <li className="event-list__row">
      <div className="event-list__head">
        <span className="event-list__type">
          Tx #{tx.txIndex} · {tx.success ? "success" : "failed"}
        </span>
        <span className="event-list__pkg">
          gas {formatNumber(tx.gasUsed)} / {formatNumber(tx.gasWanted)}
          {detail && detail.feeUgnot > 0 ? ` · fee ${formatGnotAmount(detail.feeUgnot)}` : ""}
        </span>
      </div>

      {detail?.messages.map((message, i) => (
        <div key={i} className="block-tx__message">
          <p className="block-tx__summary">{describeTxMessage(message)}</p>
          <dl className="event-list__attrs">
            {message.kind === "send" && (
              <>
                <span className="event-list__attr">
                  <dt>from</dt>
                  <dd><Linkified text={message.from} /></dd>
                </span>
                <span className="event-list__attr">
                  <dt>to</dt>
                  <dd><Linkified text={message.to} /></dd>
                </span>
              </>
            )}
            {message.kind === "call" && (
              <>
                <span className="event-list__attr">
                  <dt>caller</dt>
                  <dd><Linkified text={message.caller} /></dd>
                </span>
                <span className="event-list__attr">
                  <dt>realm</dt>
                  <dd>
                    <button
                      type="button"
                      className="data-table__link"
                      onClick={() => {
                        openInRealmTab("realm", { packagePath: message.packagePath });
                        focusOrReopen("realm");
                      }}
                    >
                      {message.packagePath}
                    </button>
                  </dd>
                </span>
                {message.args.length > 0 && (
                  <span className="event-list__attr">
                    <dt>args</dt>
                    <dd className="block-tx__args">{message.args.join(", ")}</dd>
                  </span>
                )}
              </>
            )}
            {message.kind === "addpkg" && (
              <>
                <span className="event-list__attr">
                  <dt>creator</dt>
                  <dd><Linkified text={message.creator} /></dd>
                </span>
                <span className="event-list__attr">
                  <dt>path</dt>
                  <dd>{message.packagePath}</dd>
                </span>
              </>
            )}
            {message.kind === "run" && (
              <span className="event-list__attr">
                <dt>caller</dt>
                <dd><Linkified text={message.caller} /></dd>
              </span>
            )}
          </dl>
        </div>
      ))}

      {/* The reason, not just the fact. block_results says only that an
          error occurred; a failed transaction with no explanation is the
          least useful thing this panel could show.

          Gated on the RPC result agreeing that it failed. The two sources
          can disagree: on Topaz block 427346 the node reports the
          transaction as successful (Error null, 528,532,282 gas, every
          message success:true) while the indexer has success:false,
          "unauthorized error" and an impossible gas_wanted of 0 — for the
          same transaction, confirmed by hash. The node's own execution
          result is authoritative, so its verdict wins and the indexer's
          contradicting text is not printed over a transaction the chain
          says worked. See ADR-020. */}
      {detail?.error && !tx.success && (
        <p className="block-tx__error" role="alert">
          {detail.error}
        </p>
      )}
      {detail?.error && tx.success && (
        <p className="block-tx__disagreement">
          The indexer records this as failed ({detail.error}), but the chain itself reports it
          succeeded. Showing the chain&rsquo;s result.
        </p>
      )}

      <dl className="event-list__attrs">
        {detail?.memo && (
          <span className="event-list__attr">
            <dt>memo</dt>
            <dd>{detail.memo}</dd>
          </span>
        )}
        {tx.events.length > 0 && (
          <span className="event-list__attr">
            <dt>events</dt>
            {/* Named types only. Some chain events carry an empty type —
                a real gnoswap transaction on Topaz emits 38 events of
                which 9 are unnamed — and joining those in produced a run
                of ", , , , ," that read as a rendering bug. The count
                still covers all of them. */}
            <dd>
              {tx.events.length}
              {(() => {
                const named = tx.events.map((e) => e.type).filter(Boolean);
                return named.length > 0 ? ` (${named.join(", ")})` : "";
              })()}
            </dd>
          </span>
        )}
        {detail?.hash && (
          <span className="event-list__attr">
            <dt>hash</dt>
            <dd className="block-tx__hash">{detail.hash}</dd>
          </span>
        )}
      </dl>
    </li>
  );
}

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
  const { blocks, isError } = useLiveActivity(paused);
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
    label: height !== null ? `Block #${formatNumber(height)}` : "Block Explorer",
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

  // What the transactions actually DID — signer, function, arguments,
  // amounts, failure reason. None of that is in block_results, so this is
  // a separate, additive query: without an indexer the rows below still
  // render from RPC alone, just without the detail.
  const indexerConfigured = !!sdk.networks.getActive().indexerGraphqlUrl;
  const { data: txDetail } = useQuery({
    queryKey: ["block-transactions", networkId, height],
    queryFn: async () => (await sdk.indexer.blockTransactions(height!)).data,
    enabled: height !== null && !!block && block.numTxs > 0 && indexerConfigured,
    // A missing indexer row is a downgrade in detail, not an error worth
    // showing — the RPC row above is still correct and complete on its own
    // terms.
    retry: false,
  });
  const detailByIndex = new Map((txDetail ?? []).map((tx) => [tx.txIndex, tx]));

  function selectBlock(h: number) {
    setLatest(false);
    setHeight(h);
    setDraftHeight(String(h));
  }

  // With the filter on, the list comes from the indexer rather than from the
  // live feed. Filtering the feed could not answer the question: on Topaz
  // none of the last 40 blocks had a transaction, so the honest result of
  // filtering twelve live blocks was always "none".
  const withTxs = useBlocksWithTxs(txsOnly);
  const visibleBlocks = txsOnly
    ? withTxs.indexerConfigured
      ? withTxs.blocks
      : blocks.filter((b) => b.numTxs > 0)
    : blocks;

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
          {/* The app's rule is to say where data came from (AUD-047). With
              the filter on this list is indexer-derived history, not the
              live feed, and those blocks can be a long way behind the tip —
              554 blocks, when this was measured on Topaz. Presenting them
              in the same list as live blocks without saying so would make
              the feed look stalled. */}
          {txsOnly && withTxs.indexerConfigured && visibleBlocks.length > 0 && (
            <p className="state-line">
              Most recent blocks containing transactions, from the indexer — not the live feed, so
              these can sit well behind the current height.
            </p>
          )}
          {warnings.length > 0 && (
            <p className="panel__notice">{warnings.map((w) => w.message).join(" ")}</p>
          )}
          {txsOnly && withTxs.error ? (
            <ErrorState
              message="Could not search block history"
              error={withTxs.error}
              onRetry={withTxs.retry}
            />
          ) : txsOnly && withTxs.isPending ? (
            <p className="state-line" aria-busy="true">
              Searching block history for transactions…
            </p>
          ) : blocks.length === 0 && !txsOnly ? (
            <LiveFeedStatus isError={isError} watching="Watching the chain for new blocks…" />
          ) : visibleBlocks.length === 0 ? (
            <p className="state-line">
              {txsOnly && !withTxs.indexerConfigured
                ? `${sdk.networks.getActive().name} has no indexer, so only the blocks seen since this window opened can be searched — and none of them have transactions.`
                : "No blocks with transactions found."}
            </p>
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
                    #{formatNumber(b.height)}
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
              <button type="button" onClick={() => openExplorer(explorerUrl)}>
                Open the explorer
              </button>
            )}
          </form>

          {error ? (
            <ErrorState
              message={`Could not load block #${height}`} error={error}
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
                <dd>#{formatNumber(block.height)}</dd>
                <dt>Time</dt>
                <dd>{block.time}</dd>
                <dt>Transactions</dt>
                <dd>
                  {block.numTxs} (chain total: {formatNumber(block.totalTxs)})
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
                        <BlockTxRow
                          key={tx.txIndex}
                          tx={tx}
                          detail={detailByIndex.get(tx.txIndex)}
                        />
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
