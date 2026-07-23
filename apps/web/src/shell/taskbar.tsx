import { useEffect, useRef, useState } from "react";
import { useWindowStore } from "./window-store";
import { useThemeStore } from "./theme-store";
import { useNetworkStatus } from "./use-network-status";
import { iconForWindowId, APP_REGISTRY } from "./app-registry";
import { useRealmTabsStore } from "./realm-tabs-store";

const ACCENT_VAR: Record<string, string> = {
  cyan: "var(--accent-cyan)",
  amber: "var(--accent-amber)",
  magenta: "var(--accent-magenta)",
  green: "var(--accent-green)",
  blue: "var(--accent-blue)",
  red: "var(--accent-red)",
};

function desktopBounds(): { width: number; height: number } {
  const el = document.querySelector(".desktop");
  const rect = el?.getBoundingClientRect();
  return { width: rect?.width ?? window.innerWidth, height: rect?.height ?? window.innerHeight };
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
  const tile = useWindowStore((s) => s.tile);
  const createNewRealmWindow = useRealmTabsStore((s) => s.createNewWindow);
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

  return (
    <div className="taskbar" role="toolbar" aria-label="Windows">
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
      <div className="taskbar__items">
        {openEntries.map(([id, w]) => (
          <button
            key={id}
            type="button"
            className="taskbar__item"
            data-minimized={w.minimized}
            style={{ ["--taskbar-accent" as string]: ACCENT_VAR[accents[id] ?? "cyan"] }}
            onClick={() => openWindow(id, w)}
          >
            {w.minimized ? (isModern ? "🔽 " : "▁ ") : ""}
            <span className="taskbar__item-icon" aria-hidden="true">
              {iconForWindowId(id)}
            </span>
            {w.title}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="taskbar__tile-button"
        title="Tile all windows"
        aria-label="Tile all windows"
        onClick={() => tile(desktopBounds())}
      >
        {isModern ? "⊞" : "[##]"}
      </button>
      <span className="taskbar__clock" title={now.toISOString()}>
        {formatClock(now)} {data ? `#${data.latestHeight}` : "#…"}
      </span>
    </div>
  );
}
