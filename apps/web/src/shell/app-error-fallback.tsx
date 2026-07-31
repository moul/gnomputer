import { useState } from "react";
import { crashReportUrl } from "./bug-report";
import {
  clearDisposableData,
  eraseAllLocalData,
  exportUserContent,
  downloadJson,
} from "./local-data-recovery";

/** `inline`: this crash was caught by a small local ErrorBoundary around
 * one piece of chrome (island bar, command palette) — the rest of the app
 * is still alive underneath, so this must NOT force a full-viewport
 * takeover the way the router's route-level fallback does, or it would
 * shove the still-working desktop out of view below the fold. */
export function AppErrorFallback({ error, inline = false }: { error: Error; inline?: boolean }) {
  const [show, setShow] = useState(false);
  const [confirmErase, setConfirmErase] = useState(false);
  const [busy, setBusy] = useState<null | "clear" | "erase" | "export">(null);
  const [status, setStatus] = useState<string | null>(null);

  async function run(kind: "clear" | "erase" | "export", fn: () => Promise<void>) {
    setBusy(kind);
    setStatus(null);
    try {
      await fn();
    } catch (e) {
      // Report the real failure instead of reloading and implying success —
      // the previous implementation reloaded even on error/blocked.
      setStatus((e as Error).message || "That didn't work.");
    } finally {
      setBusy(null);
    }
  }

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
        {/* Reload first: most crashes are transient, and it risks nothing. */}
        <button type="button" className="app-error__primary" onClick={() => window.location.reload()}>
          Reload
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void run("clear", async () => {
            await clearDisposableData();
            window.location.reload();
          })}
        >
          {busy === "clear" ? "Resetting…" : "Reset layout & cached data"}
        </button>
        <a href={crashReportUrl(error)} target="_blank" rel="noreferrer">
          Report this error ↗
        </a>
      </div>

      <p className="app-error__hint">
        <strong>Reload</strong> changes nothing. <strong>Reset layout &amp; cached data</strong> clears
        your window layout, theme and cached chain data — the most likely fix if a recent update
        changed the shape of that saved data. It <em>keeps</em> your saved scripts, Trails, favorites
        and workspaces, and never touches anything on chain.
      </p>

      <details className="app-error__danger">
        <summary>Still broken? Erase all local data</summary>
        <p className="app-error__hint">
          This deletes <strong>everything Gnomputer has stored in this browser</strong>, including
          your <strong>saved Editor scripts</strong>, <strong>Trails</strong>, favorites and
          workspaces. It cannot be undone. Export a backup first.
        </p>
        <div className="app-error__actions">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void run("export", async () => {
              const data = await exportUserContent();
              downloadJson(data, `gnomputer-backup-${new Date().toISOString().slice(0, 10)}.json`);
              setStatus("Backup downloaded.");
            })}
          >
            {busy === "export" ? "Exporting…" : "Export my data"}
          </button>
          {!confirmErase ? (
            <button type="button" disabled={busy !== null} onClick={() => setConfirmErase(true)}>
              Erase all local data…
            </button>
          ) : (
            <button
              type="button"
              className="app-error__destructive"
              disabled={busy !== null}
              onClick={() => void run("erase", async () => {
                await eraseAllLocalData();
                window.location.reload();
              })}
            >
              {busy === "erase" ? "Erasing…" : "Yes, erase everything"}
            </button>
          )}
        </div>
      </details>

      {status && (
        <p className="app-error__status" role="status">
          {status}
        </p>
      )}
    </div>
  );

  if (inline) return <div className="app-error-inline">{card}</div>;
  return <div className="app-error-page">{card}</div>;
}
