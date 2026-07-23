import { useEffect, useState } from "react";
import { useLiveActivity } from "../use-live-activity";
import { useSdk } from "../sdk-context";
import { formatTimeAgo } from "../format-time-ago";

export function RecentActivity() {
  const sdk = useSdk();
  const { blocks } = useLiveActivity();
  const [now, setNow] = useState(() => Date.now());
  const warnings = sdk.networks.getActive().warnings ?? [];

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="recent-activity">
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
              <span className="activity-list__height">#{block.height}</span>
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
