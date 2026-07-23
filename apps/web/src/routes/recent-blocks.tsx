import { useEffect, useState } from "react";
import { useSdk } from "../sdk-context";
import { formatTimeAgo } from "../format-time-ago";
import { useLiveActivity } from "../use-live-activity";
import { openRef } from "../shell/open-ref";

export function RecentBlocks() {
  const sdk = useSdk();
  const networkId = sdk.networks.getActive().id;
  const [paused, setPaused] = useState(false);
  const { blocks } = useLiveActivity(paused);
  const [now, setNow] = useState(() => Date.now());
  const warnings = sdk.networks.getActive().warnings ?? [];

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="recent-activity">
      <div className="recent-activity__toolbar">
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
      ) : (
        <ul className="activity-list">
          {blocks.map((block) => (
            <li key={block.height} className="activity-list__row">
              <button
                type="button"
                className="activity-list__height"
                onClick={() => openRef(`gno://${networkId}/block/${block.height}`)}
              >
                #{block.height}
              </button>
              <span className="activity-list__txs">
                {block.numTxs} {block.numTxs === 1 ? "transaction" : "transactions"}
              </span>
              <span className="activity-list__time">{formatTimeAgo(block.time, now)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
