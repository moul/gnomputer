import { useEffect, useRef, useState } from "react";
import { useWindowStore, useFocusedWindow, TILE_MODE_LABELS, type WindowRecord } from "./window-store";
import { useThemeStore } from "./theme-store";
import { useNetworkStatus } from "./use-network-status";
import { iconForWindowId, APP_REGISTRY } from "./app-registry";
import { useRealmTabsStore } from "./realm-tabs-store";
import { desktopBounds } from "./desktop-bounds";
import { formatRealmLabel } from "./format-realm-label";
import { useShellStore } from "../store";

const ACCENT_VAR: Record<string, string> = {
  cyan: "var(--accent-cyan)",
  amber: "var(--accent-amber)",
  magenta: "var(--accent-magenta)",
  green: "var(--accent-green)",
  blue: "var(--accent-blue)",
  red: "var(--accent-red)",
};

// Shortens fixed multi-word app titles for the compact taskbar row — the
// full name is still what's in the start menu and the window's own
// titlebar, this is only the taskbar's space-constrained label.
const SHORT_LABELS: Record<string, string> = {
  "network-monitor": "Network",
  "validator-monitor": "Validators",
  "block-explorer": "Blocks",
  "event-explorer": "Events",
  "world-explorer": "World",
};

function isRealmWindowId(id: string): boolean {
  return id === "realm" || id.startsWith("realm-");
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatClock(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function Taskbar({ accents }: { accents: Record<string, string> }) {
  const windows = useWindowStore((s) => s.windows);
  const reopen = useWindowStore((s) => s.reopen);
  const focus = useWindowStore((s) => s.focus);
  const restore = useWindowStore((s) => s.restore);
  const close = useWindowStore((s) => s.close);
  const cycleTile = useWindowStore((s) => s.cycleTile);
  const tileMode = useWindowStore((s) => s.tileMode);
  const createNewRealmWindow = useRealmTabsStore((s) => s.createNewWindow);
  const removeRealmWindow = useRealmTabsStore((s) => s.removeWindow);
  const removeWindowRecord = useWindowStore((s) => s.remove);
  const realmTabWindows = useRealmTabsStore((s) => s.windows);
  const setHoveredWindowId = useShellStore((s) => s.setHoveredWindowId);
  const focused = useFocusedWindow();
  const isModern = useThemeStore((s) => s.theme.startsWith("modern"));
  const { data } = useNetworkStatus();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen]);

  const openEntries = Object.entries(windows).filter(([, w]) => !w.closed);

  function scrollToWindow(id: string) {
    document
      .getElementById(`window-${id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }

  function openWindow(id: string, w: { closed: boolean; minimized: boolean }) {
    if (w.closed) reopen(id);
    else if (w.minimized) restore(id);
    else focus(id);
    scrollToWindow(id);
  }

  function launchApp(app: (typeof APP_REGISTRY)[number]) {
    if (app.supportsMultiWindow) {
      const newId = createNewRealmWindow();
      // The new window mounts (and calls ensureWindow, giving it the
      // topmost zIndex) on the next render — scrollIntoView needs to wait
      // for that DOM node to exist.
      requestAnimationFrame(() => scrollToWindow(newId));
    } else {
      const win = windows[app.id];
      if (win) openWindow(app.id, win);
    }
    setMenuOpen(false);
  }

  function labelFor(id: string, w: WindowRecord): string {
    if (isRealmWindowId(id)) {
      const rw = realmTabWindows[id];
      const activeTab = rw?.tabs.find((t) => t.id === rw.activeTabId);
      if (!activeTab || activeTab.packagePath === "") return "Browser";
      return formatRealmLabel(activeTab.packagePath, 20);
    }
    return SHORT_LABELS[id] ?? w.title;
  }

  // Pop-out realm windows (dynamic ids, not in APP_REGISTRY) would become
  // unreachable if just marked closed — nothing in the start menu can
  // reopen a "realm-3". Closing one from the taskbar has to fully destroy
  // it, same as its own titlebar close button (extra-realm-windows.tsx).
  function closeFromTaskbar(id: string) {
    if (id.startsWith("realm-")) {
      removeRealmWindow(id);
      removeWindowRecord(id);
    } else {
      close(id);
    }
  }

  return (
    <div className="taskbar" role="toolbar" aria-label="Windows">
      <div className="taskbar__start-col">
        <div className="taskbar__start" ref={menuRef}>
          <button
            type="button"
            className="taskbar__start-button"
            aria-haspopup="true"
            aria-expanded={menuOpen}
            aria-label="Open apps menu"
            onClick={() => setMenuOpen((v) => !v)}
          >
            {isModern ? "🧭 Apps" : "[apps]"}
          </button>
          {menuOpen && (
            <div className="taskbar__start-menu" role="menu">
              {APP_REGISTRY.map((app) => (
                <button
                  key={app.id}
                  type="button"
                  role="menuitem"
                  className="taskbar__start-item"
                  style={{ ["--taskbar-accent" as string]: ACCENT_VAR[accents[app.id] ?? "cyan"] }}
                  onClick={() => launchApp(app)}
                >
                  <span className="taskbar__item-icon" aria-hidden="true">
                    {app.icon}
                  </span>
                  {app.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          className="taskbar__tile-button"
          title={`Layout: ${TILE_MODE_LABELS[tileMode]} (click to cycle)`}
          aria-label={`Change window layout — currently ${TILE_MODE_LABELS[tileMode]}`}
          onClick={() => cycleTile(desktopBounds())}
        >
          {isModern ? "⊞" : "[##]"}
        </button>
      </div>
      <div className="taskbar__items">
        {openEntries.map(([id, w]) => (
          <span
            key={id}
            className="taskbar__item"
            data-minimized={w.minimized}
            data-focused={focused?.id === id}
            style={{ ["--taskbar-accent" as string]: ACCENT_VAR[accents[id] ?? "cyan"] }}
            onMouseEnter={() => setHoveredWindowId(id)}
            onMouseLeave={() => setHoveredWindowId(null)}
          >
            <button type="button" onClick={() => openWindow(id, w)}>
              {w.minimized ? (isModern ? "🔽 " : "▁ ") : ""}
              <span className="taskbar__item-icon" aria-hidden="true">
                {iconForWindowId(id)}
              </span>
              {labelFor(id, w)}
            </button>
            <button
              type="button"
              className="taskbar__item-close"
              aria-label={`Close ${w.title}`}
              onClick={(e) => {
                e.stopPropagation();
                closeFromTaskbar(id);
              }}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="taskbar__clock" title={now.toISOString()}>
        <span className="taskbar__clock-time">{formatClock(now)}</span>
        <span className="taskbar__clock-height">{data ? `#${data.latestHeight}` : "#…"}</span>
      </div>
    </div>
  );
}
