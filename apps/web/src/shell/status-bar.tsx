import { useEffect, useState } from "react";
import { useShellStore } from "../store";
import { useFocusedWindow, useWindowStore } from "./window-store";
import { useNetworkStatus } from "./use-network-status";
import { openSettings } from "./open-settings";
import { useThemeStore, THEME_LABELS } from "./theme-store";

const THEME_ICON: Record<string, string> = {
  "ascii-dark": "◐",
  "ascii-light": "◑",
  modern: "◈",
};

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatClock(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function StatusBar() {
  const setCommandPaletteOpen = useShellStore((s) => s.setCommandPaletteOpen);
  const reopenWindow = useWindowStore((s) => s.reopen);
  const focused = useFocusedWindow();
  const { data, state, network } = useNetworkStatus();
  const theme = useThemeStore((s) => s.theme);
  const cycleTheme = useThemeStore((s) => s.cycleTheme);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="status-bar" role="banner">
      <div className="status-bar__left">
        <span className="status-bar__brand">Gnomputer</span>
        {focused && (
          <span className="status-bar__context" aria-live="polite">
            {focused.title}
          </span>
        )}
      </div>
      <button
        type="button"
        className="status-bar__search"
        onClick={() => setCommandPaletteOpen(true)}
        aria-label="Open command palette (Cmd+K)"
      >
        🔍 Search…
      </button>
      <div className="status-bar__right">
        <span className="status-bar__clock" title={now.toISOString()}>
          {formatClock(now)} {data ? `#${data.latestHeight}` : "#…"}
        </span>
        <button
          type="button"
          className="status-bar__icon-button"
          onClick={() => reopenWindow("history")}
          title="History — everywhere you've been this session"
          aria-label="History"
        >
          🕘 History
        </button>
        <button
          type="button"
          className="status-bar__icon-button"
          onClick={cycleTheme}
          title={`Theme: ${THEME_LABELS[theme]} — click to cycle`}
          aria-label="Cycle theme"
        >
          {THEME_ICON[theme]}
        </button>
        <button
          type="button"
          className="status-bar__icon-button"
          data-state={state}
          onClick={() => openSettings("network")}
          title={`${network.name} — click for network settings`}
          aria-label="Network settings"
        >
          <span className="status-dot" data-state={state} aria-hidden="true" />
          {network.id}
        </button>
        <button
          type="button"
          className="status-bar__icon-button"
          onClick={() => openSettings("user")}
          title="Browsing as guest — click to view profile / connect"
          aria-label="User settings"
        >
          🔌 guest
        </button>
      </div>
    </header>
  );
}
