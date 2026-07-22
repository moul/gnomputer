import { useWindowStore } from "./window-store";

export function WindowDock() {
  const windows = useWindowStore((s) => s.windows);
  const reopen = useWindowStore((s) => s.reopen);

  const closed = Object.entries(windows).filter(([, w]) => w.closed);
  if (closed.length === 0) return null;

  return (
    <div className="window-dock" role="toolbar" aria-label="Closed windows">
      {closed.map(([id, w]) => (
        <button key={id} type="button" onClick={() => reopen(id)}>
          + {w.title}
        </button>
      ))}
    </div>
  );
}
