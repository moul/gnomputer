import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  DISPOSABLE_STORES,
  USER_CONTENT_STORES,
  clearQueryCache,
  countRows,
  downloadJson,
  exportUserContent,
} from "./local-data-recovery";

/** Human labels for the raw store names. The names are an implementation
 * detail; someone deciding whether to clear something needs to know what it
 * is, not what the table is called. */
const STORE_LABELS: Record<string, string> = {
  scripts: "Editor scripts",
  trails: "Trails",
  trailSteps: "Trail steps",
  favorites: "Favorites",
  meta: "Layout, theme and preferences",
  queryCache: "Cached chain responses",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  // Browser quotas are routinely a gigabyte or more, and "2048.0 MB" reads
  // as a number rather than as an amount.
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

/** What this app has stored in this browser, and the one safe way to reclaim
 * some of it (AUD-042).
 *
 * The audit asked for storage and cache-size controls. The honest version of
 * that has to separate what is regenerable from what is not: the crash screen
 * already learned this lesson the hard way, having once promised to clear
 * settings while actually deleting everything. So this lists the two groups
 * separately and only offers to clear the regenerable one.
 */
export function SettingsStorageTab() {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<Record<string, number> | null>(null);
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null);
  const [busy, setBusy] = useState<"clear" | "export" | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setRows(await countRows());
    } catch {
      // Storage being unavailable is a supported state everywhere else in
      // this app, so it is a blank panel here rather than an error.
      setRows({});
    }
    try {
      const estimate = await navigator.storage?.estimate?.();
      if (estimate?.usage !== undefined && estimate.quota !== undefined) {
        setUsage({ usage: estimate.usage, quota: estimate.quota });
      }
    } catch {
      setUsage(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function run(kind: "clear" | "export", fn: () => Promise<void>) {
    setBusy(kind);
    setNote(null);
    try {
      await fn();
    } catch (error) {
      setNote(error instanceof Error ? error.message : "That didn't work.");
    } finally {
      setBusy(null);
      await refresh();
    }
  }

  const cachedRows = rows?.queryCache ?? 0;

  return (
    <div className="settings-section">
      <p className="settings-section-label">Storage</p>
      <p className="state-line">
        Everything Gnomputer keeps is in this browser. Nothing here is uploaded, and nothing here is
        on chain.
      </p>

      {usage && (
        <p className="state-line">
          This origin is using <strong>{formatBytes(usage.usage)}</strong> of about{" "}
          {formatBytes(usage.quota)} available. That figure is the browser's, and covers the app
          itself and the offline cache as well as the data below.
        </p>
      )}

      <p className="settings-section-label">Yours — never cleared automatically</p>
      <dl className="account-fields">
        {USER_CONTENT_STORES.map((store) => (
          <div key={store} style={{ display: "contents" }}>
            <dt>{STORE_LABELS[store] ?? store}</dt>
            <dd>{rows === null ? "…" : (rows[store] ?? 0)}</dd>
          </div>
        ))}
      </dl>

      <p className="settings-section-label">Regenerable</p>
      <dl className="account-fields">
        {DISPOSABLE_STORES.map((store) => (
          <div key={store} style={{ display: "contents" }}>
            <dt>{STORE_LABELS[store] ?? store}</dt>
            <dd>{rows === null ? "…" : (rows[store] ?? 0)}</dd>
          </div>
        ))}
      </dl>

      <div className="settings-actions">
        <button
          type="button"
          disabled={busy !== null || cachedRows === 0}
          onClick={() =>
            void run("clear", async () => {
              await clearQueryCache();
              // The in-memory copy has to go too, or the app keeps serving
              // from RAM what was just deleted from disk and the row count
              // says zero while the UI still shows cached answers.
              queryClient.clear();
              setNote("Cached chain responses cleared. Everything will be re-fetched as you use it.");
            })
          }
        >
          {busy === "clear" ? "Clearing…" : "Clear cached chain data"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() =>
            void run("export", async () => {
              const data = await exportUserContent();
              downloadJson(data, `gnomputer-backup-${new Date().toISOString().slice(0, 10)}.json`);
              setNote("Exported your scripts, Trails and favorites.");
            })
          }
        >
          {busy === "export" ? "Exporting…" : "Export my data"}
        </button>
      </div>

      <p className="state-line">
        Clearing the cache keeps your layout, theme and preferences — and everything under
        &ldquo;Yours&rdquo; above. It only drops chain responses, which come back on their own.
      </p>

      {note && <p className="panel__notice">{note}</p>}
    </div>
  );
}
