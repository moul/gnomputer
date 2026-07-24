import { useState } from "react";
import { crashReportUrl } from "./bug-report";

// Gnomputer keeps everything it persists — window layout, theme, zoom,
// network/settings choices, Trails, favorites, the query cache — in one
// IndexedDB database. A schema change that isn't backward-compatible with
// already-persisted data is the most likely cause of an otherwise-baffling
// crash, so wiping it is the first thing worth trying, not a last resort.
const DB_NAME = "gnomputer";

function clearStateAndReload() {
  const req = indexedDB.deleteDatabase(DB_NAME);
  req.onsuccess = () => window.location.reload();
  req.onerror = () => window.location.reload();
  req.onblocked = () => window.location.reload();
}

/** `inline`: this crash was caught by a small local ErrorBoundary around
 * one piece of chrome (island bar, command palette) — the rest of the app
 * is still alive underneath, so this must NOT force a full-viewport
 * takeover the way the router's route-level fallback does, or it would
 * shove the still-working desktop out of view below the fold. */
export function AppErrorFallback({ error, inline = false }: { error: Error; inline?: boolean }) {
  const [show, setShow] = useState(false);

  const card = (
    <div className="app-error">
      <span className="app-error__brand">Gnomputer</span>
      <div className="app-error__header">
        <strong>Something went wrong!</strong>
        <button type="button" className="app-error__toggle" onClick={() => setShow((s) => !s)}>
          {show ? "Hide Error" : "Show Error"}
        </button>
      </div>
      {show && (
        <pre className="app-error__stack">
          <code>{error.stack || error.message}</code>
        </pre>
      )}
      <div className="app-error__actions">
        <button type="button" className="app-error__primary" onClick={clearStateAndReload}>
          Clear state &amp; reload
        </button>
        <a href={crashReportUrl(error)} target="_blank" rel="noreferrer">
          Report this error ↗
        </a>
      </div>
      <p className="app-error__hint">
        Gnomputer keeps its layout and settings in your browser (IndexedDB) — if a recent update
        changed that data&rsquo;s shape, clearing it is the most likely fix. This only clears local
        settings/layout, not anything on chain.
      </p>
    </div>
  );

  if (inline) return <div className="app-error-inline">{card}</div>;
  return <div className="app-error-page">{card}</div>;
}
