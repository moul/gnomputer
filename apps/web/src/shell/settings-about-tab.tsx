import { useEffect, useState } from "react";
import { useSdk } from "../sdk-context";
import { useRequestStatsStore } from "./request-stats-store";
import { formatTimeAgo } from "../format-time-ago";

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export function SettingsAboutTab() {
  const sdk = useSdk();
  const requestCount = useRequestStatsStore((s) => s.requestCount);
  const bootedAt = useRequestStatsStore((s) => s.bootedAt);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="settings-tab">
      <dl className="account-fields">
        <dt>Repository</dt>
        <dd>
          <a href={__GIT_REPO__} target="_blank" rel="noreferrer">
            {__GIT_REPO__.replace("https://", "")}
          </a>
        </dd>
        <dt>Commit</dt>
        <dd>
          <a href={`${__GIT_REPO__}/commit/${__GIT_HASH__}`} target="_blank" rel="noreferrer">
            {__GIT_HASH__}
          </a>
        </dd>
        <dt>Build date</dt>
        <dd>
          {new Date(__BUILD_TIME__).toLocaleString()} ({formatTimeAgo(__BUILD_TIME__, now)})
        </dd>
      </dl>
      <p className="settings-section-label">Session stats</p>
      <dl className="account-fields">
        <dt>Requests fetched</dt>
        <dd>{requestCount}</dd>
        <dt>Session uptime</dt>
        <dd>{formatUptime(now - bootedAt)}</dd>
        <dt>Active network</dt>
        <dd>{sdk.networks.getActive().name}</dd>
      </dl>
    </div>
  );
}
