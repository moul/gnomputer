import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSdk } from "../sdk-context";
import { useTrailRecorder } from "../use-trail-recorder";
import { usePendingRefsStore } from "../shell/pending-refs-store";
import { useNetworkStatus } from "../shell/use-network-status";

// Trail a couple of blocks behind the chain tip — the very latest block can
// briefly 404 against getBlockSummary before it's fully indexed.
const LATEST_SAFETY_MARGIN = 2;

export function BlockExplorer() {
  const sdk = useSdk();
  const networkId = sdk.networks.getActive().id;
  const [draftHeight, setDraftHeight] = useState("");
  const [height, setHeight] = useState<number | null>(null);
  const [latest, setLatest] = useState(true);
  const pendingHeight = usePendingRefsStore((s) => s.pendingBlockHeight);
  const { data: status } = useNetworkStatus();

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
    label: height !== null ? `Block #${height}` : "Block Explorer",
  });

  const {
    data: block,
    error,
    isPending,
  } = useQuery({
    queryKey: ["block-detail", networkId, height],
    queryFn: async () => {
      const env = await sdk.rpc.getBlockSummary(height!);
      return env.data;
    },
    enabled: height !== null,
  });

  return (
    <div className="block-explorer">
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
      </form>

      {error ? (
        <p className="state-line" role="alert">
          Could not load block #{height}: {error.message}
        </p>
      ) : isPending || !block ? (
        <p className="state-line" aria-busy="true">
          Loading block…
        </p>
      ) : (
        <dl className="account-fields">
          <dt>Height</dt>
          <dd>#{block.height}</dd>
          <dt>Time</dt>
          <dd>{block.time}</dd>
          <dt>Transactions</dt>
          <dd>
            {block.numTxs} (chain total: {block.totalTxs.toLocaleString()})
          </dd>
          <dt>Proposer</dt>
          <dd>{block.proposerAddress}</dd>
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
      )}
    </div>
  );
}
