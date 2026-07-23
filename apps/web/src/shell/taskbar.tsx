import { useEffect, useRef, useState } from "react";
import { useWindowStore } from "./window-store";
import { useThemeStore } from "./theme-store";
import { useNetworkStatus } from "./use-network-status";

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

  const allEntries = Object.entries(windows);
  const openEntries = allEntries.filter(([, w]) => !w.closed);

  function openWindow(id: string, w: { closed: boolean; minimized: boolean }) {
    if (w.closed) reopen(id);
    else if (w.minimized) restore(id);
    else focus(id);
    document
      .getElementById(`window-${id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
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
        {menuOpen && allEntries.length > 0 && (
          <div className="taskbar__start-menu" role="menu">
            {allEntries.map(([id, w]) => (
              <button
                key={id}
                type="button"
                role="menuitem"
                className="taskbar__start-item"
                style={{ ["--taskbar-accent" as string]: ACCENT_VAR[accents[id] ?? "cyan"] }}
                onClick={() => openWindow(id, w)}
              >
                {w.title}
                <span className="taskbar__start-item-state">
                  {w.closed ? "" : w.minimized ? "minimized" : "open"}
                </span>
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
