import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSdk } from "../sdk-context";
import { useTrailRecorder } from "../use-trail-recorder";
import { usePendingRefsStore } from "../shell/pending-refs-store";

export function BlockExplorer() {
  const sdk = useSdk();
  const networkId = sdk.networks.getActive().id;
  const [draftHeight, setDraftHeight] = useState("");
  const [height, setHeight] = useState<number | null>(null);
  const pendingHeight = usePendingRefsStore((s) => s.pendingBlockHeight);

  const { data: status } = useQuery({
    queryKey: ["block-explorer-latest", networkId],
    queryFn: async () => (await sdk.rpc.getStatus()).data,
  });

  useEffect(() => {
    if (height === null && status) {
      setHeight(status.latestHeight - 2);
      setDraftHeight(String(status.latestHeight - 2));
    }
  }, [status, height]);

  useEffect(() => {
    if (pendingHeight === null) return;
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
          if (Number.isFinite(parsed) && parsed > 0) setHeight(parsed);
        }}
      >
        <label>
          Block height
          <input
            value={draftHeight}
            onChange={(e) => setDraftHeight(e.target.value)}
            inputMode="numeric"
          />
        </label>
        <button type="submit">Open</button>
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
