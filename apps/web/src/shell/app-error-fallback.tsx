import { useState } from "react";

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

function issueUrl(error: Error): string {
  const title = `Crash: ${error.message || "Unknown error"}`.slice(0, 200);
  const body = [
    "**What were you doing when this happened?**",
    "",
    "_(fill in — helps reproduce it)_",
    "",
    "**Error**",
    "```",
    (error.stack || error.message || String(error)).slice(0, 4000),
    "```",
    "",
    "**Build**",
    `- URL: ${window.location.href}`,
    `- Build: ${__GIT_HASH__} (${__BUILD_TIME__})`,
    `- User agent: ${navigator.userAgent}`,
  ].join("\n");
  const params = new URLSearchParams({ title, body, labels: "bug" });
  return `${__GIT_REPO__}/issues/new?${params.toString()}`;
}

export function AppErrorFallback({ error }: { error: Error }) {
  const [show, setShow] = useState(false);

  return (
    <div className="app-error">
      <div className="app-error__header">
        <strong>Something went wrong!</strong>
        <button type="button" onClick={() => setShow((s) => !s)}>
          {show ? "Hide Error" : "Show Error"}
        </button>
      </div>
      {show && (
        <pre className="app-error__stack">
          <code>{error.stack || error.message}</code>
        </pre>
      )}
      <div className="app-error__actions">
        <button type="button" onClick={clearStateAndReload}>
          Clear state &amp; reload
        </button>
        <a href={issueUrl(error)} target="_blank" rel="noreferrer">
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
}
