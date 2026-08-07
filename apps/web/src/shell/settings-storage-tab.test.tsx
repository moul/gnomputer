import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { SettingsStorageTab } from "./settings-storage-tab";
import { DISPOSABLE_STORES, USER_CONTENT_STORES } from "./local-data-recovery";

const DB_NAME = "gnomputer";
const ALL_STORES = [...USER_CONTENT_STORES, ...DISPOSABLE_STORES];

function seed(rowsPerStore: Record<string, number>): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const store of ALL_STORES) {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { autoIncrement: true });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(ALL_STORES, "readwrite");
      for (const store of ALL_STORES) {
        for (let i = 0; i < (rowsPerStore[store] ?? 0); i++) tx.objectStore(store).add({ i });
      }
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
}

let client: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(async () => {
  client = new QueryClient();
  await new Promise<void>((r) => {
    const d = indexedDB.deleteDatabase(DB_NAME);
    d.onsuccess = () => r();
    d.onerror = () => r();
    d.onblocked = () => r();
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SettingsStorageTab", () => {
  it("groups stores into yours and regenerable", async () => {
    // The separation is the feature. A single undifferentiated list would put
    // "your Trails" next to "cached responses" as if clearing either were the
    // same kind of act.
    await seed({ scripts: 2, trails: 1, favorites: 3, queryCache: 9, meta: 4 });
    render(<SettingsStorageTab />, { wrapper });

    await waitFor(() => expect(screen.getByText("Editor scripts")).toBeTruthy());
    expect(screen.getByText("Yours — never cleared automatically")).toBeTruthy();
    expect(screen.getByText("Regenerable")).toBeTruthy();
    expect(screen.getByText("Cached chain responses")).toBeTruthy();
  });

  it("reports the real row counts, not a placeholder", async () => {
    await seed({ scripts: 2, trails: 1, trailSteps: 0, favorites: 3, queryCache: 9, meta: 4 });
    const { container } = render(<SettingsStorageTab />, { wrapper });

    // Wait for the COUNT, not the label: labels render immediately and the
    // counts arrive after IndexedDB answers, so waiting on the label asserted
    // against "…" every time.
    await waitFor(() =>
      expect(within(container).getByText("Editor scripts").nextElementSibling?.textContent).toBe("2")
    );
    const text = container.textContent ?? "";
    // Row counts render beside their label; assert the pairs rather than bare
    // numbers, which would match anything.
    for (const [label, count] of [
      ["Editor scripts", "2"],
      ["Trails", "1"],
      ["Favorites", "3"],
      ["Cached chain responses", "9"],
    ] as const) {
      const dt = within(container).getByText(label);
      expect(dt.nextElementSibling?.textContent, `${label} should read ${count}`).toBe(count);
    }
    expect(text).not.toContain("NaN");
  });

  it("disables the clear button when there is nothing cached", async () => {
    // Offering to clear an empty cache is an action that cannot act — the
    // same thing the palette got wrong with "Show all windows" (#184).
    await seed({ queryCache: 0, meta: 1 });
    render(<SettingsStorageTab />, { wrapper });

    const button = await waitFor(() =>
      screen.getByRole<HTMLButtonElement>("button", { name: /Clear cached chain data/i })
    );
    await waitFor(() => expect(button.disabled).toBe(true));
  });

  it("enables the clear button once something is cached", async () => {
    await seed({ queryCache: 5, meta: 1 });
    render(<SettingsStorageTab />, { wrapper });

    const button = await waitFor(() =>
      screen.getByRole<HTMLButtonElement>("button", { name: /Clear cached chain data/i })
    );
    await waitFor(() => expect(button.disabled).toBe(false));
  });

  it("says the cache clear keeps preferences, because it does", async () => {
    // The copy and the behaviour have to agree: clearQueryCache leaves `meta`
    // alone, and this sentence is the promise a user reads before pressing it.
    await seed({ queryCache: 1, meta: 1 });
    const { container } = render(<SettingsStorageTab />, { wrapper });
    await waitFor(() => expect(screen.getByText("Regenerable")).toBeTruthy());
    expect(container.textContent).toMatch(/keeps your layout, theme and preferences/i);
  });

  it("survives storage being unavailable rather than crashing the tab", async () => {
    // Firefox private browsing and locked-down profiles make IndexedDB throw
    // on access. Everywhere else in this app that is a supported state.
    const original = Object.getOwnPropertyDescriptor(globalThis, "indexedDB");
    Object.defineProperty(globalThis, "indexedDB", {
      configurable: true,
      get() {
        throw new DOMException("The operation is insecure.", "SecurityError");
      },
    });
    try {
      render(<SettingsStorageTab />, { wrapper });
      // Zeroes, not a crash and not "…" forever.
      //
      // The count has to be awaited in its own right. Waiting only for the
      // "Regenerable" heading and then asserting synchronously was a race:
      // the heading is static markup and renders immediately, while the
      // count starts at "…" and settles a tick later, so the assertion
      // passed only when the query happened to resolve first. It usually
      // did locally and intermittently did not under CI's slower
      // coverage-instrumented run, which is the definition of a flake —
      // and one that failed an unrelated PR.
      await waitFor(() =>
        expect(screen.getByText("Editor scripts").nextElementSibling?.textContent).toBe("0")
      );
    } finally {
      if (original) Object.defineProperty(globalThis, "indexedDB", original);
    }
  });
});
