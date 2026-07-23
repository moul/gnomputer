import { useWindowStore } from "./window-store";

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

export function Taskbar({ accents }: { accents: Record<string, string> }) {
  const windows = useWindowStore((s) => s.windows);
  const reopen = useWindowStore((s) => s.reopen);
  const focus = useWindowStore((s) => s.focus);
  const restore = useWindowStore((s) => s.restore);
  const tile = useWindowStore((s) => s.tile);

  const entries = Object.entries(windows);
  if (entries.length === 0) return null;

  return (
    <div className="taskbar" role="toolbar" aria-label="Windows">
      <div className="taskbar__items">
        {entries.map(([id, w]) => (
          <button
            key={id}
            type="button"
            className="taskbar__item"
            data-open={!w.closed}
            data-minimized={w.minimized}
            style={{ ["--taskbar-accent" as string]: ACCENT_VAR[accents[id] ?? "cyan"] }}
            onClick={() => {
              if (w.closed) {
                reopen(id);
              } else if (w.minimized) {
                restore(id);
              } else {
                focus(id);
              }
              document
                .getElementById(`window-${id}`)
                ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
            }}
          >
            {w.minimized ? "▁ " : ""}
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
        [##]
      </button>
    </div>
  );
}
