import { useEffect, useState } from "react";
import { useSdk } from "../sdk-context";
import { useShellStore } from "../store";
import { useNetworkStatus } from "./use-network-status";
import { IslandPopover } from "./island-popover";
import { openRef, focusOrReopen } from "./open-ref";
import { iconForRefUri } from "./entity-icon";

// How many recent Trail steps show in the quick menu — anything older is
// still there, just behind "Open full History" (history-window.tsx).
const RECENT_STEPS_LIMIT = 5;

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatClock(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function IslandClock() {
  const sdk = useSdk();
  const trailVersion = useShellStore((s) => s.trailVersion);
  const { data, state } = useNetworkStatus();
  const [now, setNow] = useState(() => new Date());
  const [steps, setSteps] = useState<{ refUri: string; label: string }[]>([]);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const trailId = await sdk.trails.getActiveTrailId();
      if (cancelled || !trailId) return;
      const trailSteps = await sdk.trails.getSteps(trailId);
      if (cancelled) return;
      setSteps(trailSteps);
    })();
    return () => {
      cancelled = true;
    };
  }, [sdk, trailVersion]);

  const recentSteps = steps.slice(-RECENT_STEPS_LIMIT).reverse();

  return (
    <IslandPopover
      trigger={
        <div className="island__clock">
          <span className="status-dot" data-state={state} aria-hidden="true" />
          {formatClock(now)}
        </div>
      }
    >
      <div className="island-menu island-menu--clock">
        <div className="island__clock-popover-time">{formatClock(now)}</div>
        <div className="island__clock-popover-date">
          {now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </div>
        <dl className="island__clock-popover-stats">
          <dt>Chain</dt>
          <dd>{data?.chainId ?? "—"}</dd>
          <dt>Height</dt>
          <dd>
            {data ? (
              <button
                type="button"
                className="island-menu__inline-link"
                onClick={() => openRef(`gno://_/block/${data.latestHeight}`)}
              >
                #{data.latestHeight}
              </button>
            ) : (
              "—"
            )}
          </dd>
          <dt>Latency</dt>
          <dd>{data ? `${data.latencyMs}ms` : "—"}</dd>
        </dl>
        <p className="island-menu__title island-menu__title--sub">History</p>
        {recentSteps.length === 0 ? (
          <p className="island-menu__hint">Nothing visited yet on this Trail.</p>
        ) : (
          <ul className="island-menu__list">
            {recentSteps.map((step, i) => (
              <li key={`${step.refUri}-${i}`}>
                <button type="button" onClick={() => openRef(step.refUri)}>
                  <span aria-hidden="true">{iconForRefUri(step.refUri)}</span>
                  {step.label}
                </button>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="island-menu__action" onClick={() => focusOrReopen("history")}>
          Open full History →
        </button>
      </div>
    </IslandPopover>
  );
}
