import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import {
  clearDisposableData,
  exportUserContent,
  eraseAllLocalData,
  USER_CONTENT_STORES,
  DISPOSABLE_STORES,
} from "./local-data-recovery";

const DB_NAME = "gnomputer";
const ALL_STORES = [...USER_CONTENT_STORES, ...DISPOSABLE_STORES];

/** Builds a database matching the real schema's store names and seeds one
 * row per store, so we can assert exactly which survive a scoped reset. */
function seedDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of ALL_STORES) {
        if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: "id" });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(ALL_STORES, "readwrite");
      for (const s of ALL_STORES) tx.objectStore(s).put({ id: `${s}-1`, marker: s });
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
}

function readAll(store: string): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME);
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(store)) {
        db.close();
        resolve([]);
        return;
      }
      const g = db.transaction(store, "readonly").objectStore(store).getAll();
      g.onsuccess = () => {
        db.close();
        resolve(g.result as unknown[]);
      };
      g.onerror = () => reject(g.error);
    };
    req.onerror = () => reject(req.error);
  });
}

function dbExists(): Promise<boolean> {
  return new Promise((resolve) => {
    let existed = true;
    const req = indexedDB.open(DB_NAME);
    req.onupgradeneeded = () => {
      existed = false;
    };
    req.onsuccess = () => {
      req.result.close();
      resolve(existed);
    };
    req.onerror = () => resolve(false);
  });
}

describe("local data recovery", () => {
  beforeEach(async () => {
    await new Promise<void>((r) => {
      const d = indexedDB.deleteDatabase(DB_NAME);
      d.onsuccess = () => r();
      d.onerror = () => r();
      d.onblocked = () => r();
    });
    await seedDb();
  });

  it("clearDisposableData wipes layout/settings and cache but PRESERVES user content", async () => {
    await clearDisposableData();

    // The whole point of the fix: scripts, Trails, favorites, workspaces survive.
    for (const store of USER_CONTENT_STORES) {
      expect(await readAll(store), `${store} must survive a scoped reset`).toHaveLength(1);
    }
    for (const store of DISPOSABLE_STORES) {
      expect(await readAll(store), `${store} should be cleared`).toHaveLength(0);
    }
  });

  it("exportUserContent returns every user-authored store", async () => {
    const data = await exportUserContent();
    for (const store of USER_CONTENT_STORES) {
      expect(data[store]).toHaveLength(1);
    }
    // Disposable stores aren't part of a user backup.
    for (const store of DISPOSABLE_STORES) {
      expect(data[store]).toBeUndefined();
    }
  });

  it("eraseAllLocalData really deletes the database", async () => {
    expect(await dbExists()).toBe(true);
    await eraseAllLocalData();
    expect(await dbExists()).toBe(false);
  });

  it("clearDisposableData tolerates a database with none of those stores", async () => {
    await eraseAllLocalData();
    await expect(clearDisposableData()).resolves.toBeUndefined();
  });
});
