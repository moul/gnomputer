// Recovery primitives for the crash fallback. Deliberately built on the raw
// IndexedDB API rather than the app's own Dexie layer (packages/storage): a
// crash handler must keep working even when the thing that crashed is the
// data layer itself, so this takes no dependency on app code beyond the
// database name.
const DB_NAME = "gnomputer";

/** Stores holding content the user authored or curated. Losing these is real
 * data loss, so they are never touched by a scoped reset. */
// Every store here now backs a feature a user can actually reach:
// favorites shipped in #171, and `workspaces` — which never did — was
// dropped in the v4 schema (AUD-044). The list and the user-facing copy on
// the recovery screen name the same four things, which is the point: this
// screen is read by someone deciding whether to erase, and it is the worst
// possible place to promise more or less than is true.
export const USER_CONTENT_STORES = ["scripts", "trails", "trailSteps", "favorites"] as const;

/** Stores holding derived or preference data — regenerable, and the usual
 * culprit when a schema change makes already-persisted state un-loadable.
 * `meta` is window layout / theme / zoom / settings; `queryCache` is a
 * cached copy of chain responses. */
export const DISPOSABLE_STORES = ["meta", "queryCache"] as const;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    // No version passed: open whatever version exists rather than risking an
    // upgrade from inside a crash handler.
    const req = indexedDB.open(DB_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Could not open local database"));
    req.onblocked = () => reject(new Error("Database is blocked by another tab"));
  });
}

/** Clears layout/settings and the cached chain responses, leaving every
 * user-authored store intact. This is what the crash card's copy used to
 * claim it did — it actually deleted the whole database. */
export async function clearDisposableData(): Promise<void> {
  const db = await openDb();
  try {
    const present = DISPOSABLE_STORES.filter((s) => db.objectStoreNames.contains(s));
    if (present.length === 0) return;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(present, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Could not clear cached data"));
      tx.onabort = () => reject(tx.error ?? new Error("Clearing cached data was aborted"));
      for (const s of present) tx.objectStore(s).clear();
    });
  } finally {
    db.close();
  }
}

/** How many rows each store holds, so the Storage settings tab can say what
 * is actually taking up room rather than only a total from
 * navigator.storage.estimate() — which reports a single opaque number
 * covering caches, the service worker and IndexedDB together. */
export async function countRows(): Promise<Record<string, number>> {
  const db = await openDb();
  try {
    const out: Record<string, number> = {};
    for (const store of [...USER_CONTENT_STORES, ...DISPOSABLE_STORES]) {
      if (!db.objectStoreNames.contains(store)) continue;
      out[store] = await new Promise<number>((resolve, reject) => {
        const req = db.transaction(store, "readonly").objectStore(store).count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error(`Could not count ${store}`));
      });
    }
    return out;
  } finally {
    db.close();
  }
}

/** Clears ONLY the cached chain responses.
 *
 * Deliberately not clearDisposableData(), which also empties `meta` — that
 * holds the window layout, theme, zoom and every other preference. Someone
 * pressing "clear cached chain data" is reclaiming space, not asking for
 * their desktop to be rearranged, and a button that silently did both would
 * be the same class of overreach as the recovery screen that claimed to
 * clear settings and deleted everything. */
export async function clearQueryCache(): Promise<void> {
  const db = await openDb();
  try {
    if (!db.objectStoreNames.contains("queryCache")) return;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("queryCache", "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Could not clear the cache"));
      tx.onabort = () => reject(tx.error ?? new Error("Clearing the cache was aborted"));
      tx.objectStore("queryCache").clear();
    });
  } finally {
    db.close();
  }
}

/** Everything the user authored, as a JSON-serializable object — offered as
 * a download before any destructive reset so "erase" is never the only
 * option. */
export async function exportUserContent(): Promise<Record<string, unknown[]>> {
  const db = await openDb();
  try {
    const out: Record<string, unknown[]> = {};
    const present = USER_CONTENT_STORES.filter((s) => db.objectStoreNames.contains(s));
    for (const store of present) {
      out[store] = await new Promise<unknown[]>((resolve, reject) => {
        const req = db.transaction(store, "readonly").objectStore(store).getAll();
        req.onsuccess = () => resolve(req.result as unknown[]);
        req.onerror = () => reject(req.error ?? new Error(`Could not read ${store}`));
      });
    }
    return out;
  } finally {
    db.close();
  }
}

/** Deletes the entire database — scripts, Trails, favorites and workspaces
 * included. Unlike the previous implementation this REJECTS on failure
 * instead of reloading anyway, so the UI can't report success when nothing
 * was deleted. */
export function eraseAllLocalData(): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error("Could not delete the local database"));
    // Another open tab holds a connection: deleting will not complete, and
    // silently reloading would look like success while leaving data in place.
    req.onblocked = () =>
      reject(new Error("Another Gnomputer tab is open — close other tabs and try again."));
  });
}

export function downloadJson(data: unknown, filename: string): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
