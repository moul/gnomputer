import { useEffect, useRef, useState } from "react";
import { useSdk } from "../sdk-context";
import { useShellStore } from "../store";
import { useNetworkStatus } from "./use-network-status";
import { useOnlineStatus } from "./use-online-status";
import { IslandPopover } from "./island-popover";
import { openRef, focusOrReopen } from "./open-ref";
import { openSettings } from "./open-settings";
import { iconForRefUri } from "./entity-icon";
import { formatTimeAgo } from "../format-time-ago";
import { useWalletStore } from "./wallet-store";

function shortenAddress(address: string): string {
  return address.length > 13 ? `${address.slice(0, 7)}…${address.slice(-4)}` : address;
}

// How many recent Trail steps show in the quick menu — anything older is
// still there, just behind "Open full History" (history-window.tsx).
const RECENT_STEPS_LIMIT = 5;

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatClock(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function IslandClock({ disabled = false }: { disabled?: boolean }) {
  const sdk = useSdk();
  const account = useWalletStore((s) => s.account);
  const trailVersion = useShellStore((s) => s.trailVersion);
  const { data, state } = useNetworkStatus();
  const online = useOnlineStatus();
  // The browser's own offline signal is more immediate and more certain than
  // waiting for an RPC call to time out — and unambiguous in a way "error"
  // isn't (that could just as easily mean a network hiccup or a bad
  // endpoint while genuinely still online).
  const effectiveState = online ? state : "offline";
  const [now, setNow] = useState(() => new Date());
  const [steps, setSteps] = useState<{ refUri: string; label: string }[]>([]);
  const [disconnectedSince, setDisconnectedSince] = useState<string | null>(null);
  const wasConnected = useRef(effectiveState === "connected");

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const connected = effectiveState === "connected";
    if (connected) {
      setDisconnectedSince(null);
    } else if (wasConnected.current) {
      setDisconnectedSince(new Date().toISOString());
    }
    wasConnected.current = connected;
  }, [effectiveState]);

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
      disabled={disabled}
      trigger={
        // A real <button>, not a <div>: as a div this was not focusable, so
        // the connection/height/history panel behind it was unreachable by
        // keyboard entirely, and the status dot is aria-hidden so the state
        // needs saying in the accessible name.
        <button type="button" className="island__clock" aria-label={`Clock and connection status: ${effectiveState}`}>
          <span className="status-dot" data-state={effectiveState} aria-hidden="true" />
          {formatClock(now)}
        </button>
      }
    >
      <div className="island-menu island-menu--clock">
        <div className="island__clock-popover-time">{formatClock(now)}</div>
        <div className="island__clock-popover-date">
          {now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </div>
        {!online && (
          <p className="island-menu__hint island-menu__hint--offline">
            ⚠ Offline — no internet connection. Already-loaded content keeps working; anything new
            will pick back up once you're reconnected.
          </p>
        )}
        <dl className="island__clock-popover-stats">
          <dt>Connection</dt>
          <dd>
            {effectiveState === "connected" ? (
              <span className="island__clock-popover-status">
                <span className="status-dot" data-state="connected" aria-hidden="true" />
                Connected
              </span>
            ) : (
              <span className="island__clock-popover-status">
                <span className="status-dot" data-state={effectiveState} aria-hidden="true" />
                {disconnectedSince ? `Disconnected since ${formatTimeAgo(disconnectedSince, now.getTime())}` : "Not connected"}
              </span>
            )}
          </dd>
          <dt>Chain</dt>
          <dd>
            <button type="button" className="island-menu__inline-link" onClick={() => openSettings("network")}>
              {data?.chainId ?? "—"}
            </button>
          </dd>
          <dt>Height</dt>
          <dd>
            {data ? (
              <button
                type="button"
                className="island-menu__inline-link"
                onClick={(e) => openRef(`gno://_/block/${data.latestHeight}`, { x: e.clientX, y: e.clientY })}
              >
                #{data.latestHeight.toLocaleString()}
              </button>
            ) : (
              "—"
            )}
          </dd>
          <dt>Latency</dt>
          <dd>{data ? `${data.latencyMs}ms` : "—"}</dd>
          <dt>Account</dt>
          <dd>
            <button type="button" className="island-menu__inline-link" onClick={() => openSettings("user")}>
              {account ? shortenAddress(account.address) : "Guest"}
            </button>
          </dd>
        </dl>
        <p className="island-menu__title island-menu__title--sub">History</p>
        {recentSteps.length === 0 ? (
          <p className="island-menu__hint">Nothing visited yet on this Trail.</p>
        ) : (
          <ul className="island-menu__list">
            {recentSteps.map((step, i) => (
              <li key={`${step.refUri}-${i}`}>
                <button type="button" onClick={(e) => openRef(step.refUri, { x: e.clientX, y: e.clientY })}>
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
