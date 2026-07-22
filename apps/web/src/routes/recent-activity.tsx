import { useEffect, useState } from "react";
import { useLiveActivity } from "../use-live-activity";
import { useSdk } from "../sdk-context";

function relativeTime(iso: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  return `${minutes}m ago`;
}

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
    <section className="panel" aria-label="Recent activity">
      <header className="panel__header">
        <span>Recent activity</span>
      </header>
      {warnings.length > 0 && (
        <p className="panel__notice">{warnings.map((w) => w.message).join(" ")}</p>
      )}
      <div className="panel__body panel__body--activity">
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
                <span className="activity-list__time">{relativeTime(block.time, now)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
