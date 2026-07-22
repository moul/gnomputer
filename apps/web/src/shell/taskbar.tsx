import { useWindowStore } from "./window-store";

const ACCENT_VAR: Record<string, string> = {
  cyan: "var(--accent-cyan)",
  amber: "var(--accent-amber)",
  magenta: "var(--accent-magenta)",
  green: "var(--accent-green)",
  blue: "var(--accent-blue)",
  red: "var(--accent-red)",
};

export function Taskbar({ accents }: { accents: Record<string, string> }) {
  const windows = useWindowStore((s) => s.windows);
  const reopen = useWindowStore((s) => s.reopen);
  const focus = useWindowStore((s) => s.focus);

  const entries = Object.entries(windows);
  if (entries.length === 0) return null;

  return (
    <div className="taskbar" role="toolbar" aria-label="Windows">
      {entries.map(([id, w]) => (
        <button
          key={id}
          type="button"
          className="taskbar__item"
          data-open={!w.closed}
          style={{ ["--taskbar-accent" as string]: ACCENT_VAR[accents[id] ?? "cyan"] }}
          onClick={() => {
            if (w.closed) {
              reopen(id);
            } else {
              focus(id);
            }
            document
              .getElementById(`window-${id}`)
              ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
          }}
        >
          {w.title}
        </button>
      ))}
    </div>
  );
}
