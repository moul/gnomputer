import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { create } from "zustand";
import { createGnomputerSDK } from "@gnomputer/app-sdk";
import { SdkProvider } from "../sdk-context";
import { useStorePersistence } from "./use-store-persistence";

const DB_NAME = "gnomputer-store-persistence-test";

interface CounterState {
  count: number;
  setCount: (n: number) => void;
}

function makeCounterStore() {
  return create<CounterState>((set) => ({
    count: 0,
    setCount: (count) => set({ count }),
  }));
}

function wrapperFor(sdk: ReturnType<typeof createGnomputerSDK>) {
  return ({ children }: { children: React.ReactNode }) => (
    <SdkProvider overrideSdk={sdk}>{children}</SdkProvider>
  );
}

describe("useStorePersistence", () => {
  beforeEach(() => {
    indexedDB.deleteDatabase(DB_NAME);
  });

  it("restores a previously-saved whole-state blob using the default JSON serialize/deserialize", async () => {
    const sdk = createGnomputerSDK({ dbName: DB_NAME });
    await sdk.uiState.set("counter", JSON.stringify({ count: 42 }));

    const store = makeCounterStore();
    renderHook(() => useStorePersistence("counter", store), { wrapper: wrapperFor(sdk) });

    await waitFor(() => expect(store.getState().count).toBe(42));
  });

  it("persists state changes made after hydration", async () => {
    const sdk = createGnomputerSDK({ dbName: DB_NAME });
    const store = makeCounterStore();
    renderHook(() => useStorePersistence("counter", store), { wrapper: wrapperFor(sdk) });

    // Nothing is written until hydration completes AND a change happens
    // afterward, so this has to wait out the "if (!hydrated.current) return"
    // guard. A fixed 20ms sleep used to do that and flaked repeatedly under
    // load (it was the single most frequent red build this session). Instead,
    // poll for an observable consequence of hydration: once a write lands,
    // hydration must have finished.
    await waitFor(
      async () => {
        store.getState().setCount(7);
        const raw = await sdk.uiState.get("counter");
        expect(raw && JSON.parse(raw)).toMatchObject({ count: 7 });
      },
      { timeout: 3000 }
    );

  });

  it("falls back to defaults instead of throwing when the stored value is corrupt JSON", async () => {
    const sdk = createGnomputerSDK({ dbName: DB_NAME });
    await sdk.uiState.set("counter", "{not-valid-json");

    const store = makeCounterStore();
    renderHook(() => useStorePersistence("counter", store), { wrapper: wrapperFor(sdk) });

    // Give hydration a tick to run, then confirm it never applied garbage.
    await new Promise((r) => setTimeout(r, 20));
    expect(store.getState().count).toBe(0);
  });

  it("uses a custom serialize/deserialize pair instead of the whole-state JSON default", async () => {
    const sdk = createGnomputerSDK({ dbName: DB_NAME });
    await sdk.uiState.set("counter-scalar", "99");

    const store = makeCounterStore();
    renderHook(
      () =>
        useStorePersistence("counter-scalar", store, {
          serialize: (state) => String(state.count),
          deserialize: (raw) => {
            const n = Number(raw);
            return Number.isFinite(n) ? { count: n } : null;
          },
        }),
      { wrapper: wrapperFor(sdk) }
    );

    await waitFor(() => expect(store.getState().count).toBe(99));
  });

  it("skips restoring when deserialize returns null, keeping the store's defaults", async () => {
    const sdk = createGnomputerSDK({ dbName: DB_NAME });
    await sdk.uiState.set("counter-invalid", "not-a-number");

    const store = makeCounterStore();
    renderHook(
      () =>
        useStorePersistence("counter-invalid", store, {
          deserialize: (raw) => {
            const n = Number(raw);
            return Number.isFinite(n) ? { count: n } : null;
          },
        }),
      { wrapper: wrapperFor(sdk) }
    );

    await new Promise((r) => setTimeout(r, 20));
    expect(store.getState().count).toBe(0);
  });

  it("routes restoration through onRestore instead of a raw setState when provided", async () => {
    const sdk = createGnomputerSDK({ dbName: DB_NAME });
    await sdk.uiState.set("counter-onrestore", JSON.stringify({ count: 5 }));

    const store = makeCounterStore();
    let restoredWith: Partial<CounterState> | null = null;
    renderHook(
      () =>
        useStorePersistence("counter-onrestore", store, {
          onRestore: (restored) => {
            restoredWith = restored;
            // Doubling here proves this ran INSTEAD of the default setState,
            // not alongside it.
            if (restored.count !== undefined) store.getState().setCount(restored.count * 2);
          },
        }),
      { wrapper: wrapperFor(sdk) }
    );

    await waitFor(() => expect(store.getState().count).toBe(10));
    expect(restoredWith).toEqual({ count: 5 });
  });
});

describe("durability against a reload that aborts the IndexedDB write", () => {
  // This project's jsdom exposes `localStorage` as a bare object with no
  // methods, so the production code's try/catch just silently skips the
  // mirror here. Install a real one so the behaviour can actually be
  // asserted.
  beforeEach(() => {
    const store = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
        clear: () => store.clear(),
        key: (i: number) => [...store.keys()][i] ?? null,
        get length() {
          return store.size;
        },
      },
    });
  });

  it("restores from the synchronous mirror when IndexedDB lost the write", async () => {
    // Exactly the real failure: the user changed a setting and reloaded
    // before the async IndexedDB write committed (navigation aborts an
    // in-flight transaction), so uiState has nothing — but the synchronous
    // localStorage mirror does.
    localStorage.setItem(
      "gnomputer:mirror:counter",
      JSON.stringify({ value: JSON.stringify({ count: 99 }), at: Date.now() })
    );

    const sdk = createGnomputerSDK({ dbName: DB_NAME });
    const store = makeCounterStore();
    renderHook(() => useStorePersistence("counter", store), { wrapper: wrapperFor(sdk) });

    await waitFor(() => expect(store.getState().count).toBe(99));
  });

  it("never lets a stale mirror override what IndexedDB actually holds", async () => {
    // Regression: an earlier version preferred the mirror whenever the two
    // disagreed, so a leftover mirror could resurrect old state over a
    // real stored value — including over deliberately-rejected corrupt
    // JSON. CI caught it; the mirror is a fallback, not an override.
    localStorage.setItem(
      "gnomputer:mirror:counter",
      JSON.stringify({ value: JSON.stringify({ count: 7 }), at: Date.now() })
    );

    const sdk = createGnomputerSDK({ dbName: DB_NAME });
    await sdk.uiState.set("counter", JSON.stringify({ count: 3 }));

    const store = makeCounterStore();
    renderHook(() => useStorePersistence("counter", store), { wrapper: wrapperFor(sdk) });

    await waitFor(() => expect(store.getState().count).toBe(3));
    expect(store.getState().count).not.toBe(7);
  });

  it("prefers the mirror when it is newer than what IndexedDB holds", async () => {
    // The case the previous rule could not handle, and it was user-visible:
    // change the network, reload immediately, and land back on the previous
    // one. IndexedDB already held a value, so "mirror only when IndexedDB
    // has nothing" left the older value winning. An e2e caught it under
    // load. Now the newer of the two wins, decided by timestamp.
    const sdk = createGnomputerSDK({ dbName: DB_NAME });
    await sdk.uiState.set("counter", JSON.stringify({ count: 3 }));
    await sdk.uiState.set("counter:writtenAt", String(Date.now() - 5_000));

    localStorage.setItem(
      "gnomputer:mirror:counter",
      JSON.stringify({ value: JSON.stringify({ count: 7 }), at: Date.now() })
    );

    const store = makeCounterStore();
    renderHook(() => useStorePersistence("counter", store), { wrapper: wrapperFor(sdk) });
    await waitFor(() => expect(store.getState().count).toBe(7));
  });

  it("still prefers IndexedDB when it is the newer of the two", async () => {
    const sdk = createGnomputerSDK({ dbName: DB_NAME });
    localStorage.setItem(
      "gnomputer:mirror:counter",
      JSON.stringify({ value: JSON.stringify({ count: 7 }), at: Date.now() - 5_000 })
    );
    await sdk.uiState.set("counter", JSON.stringify({ count: 3 }));
    await sdk.uiState.set("counter:writtenAt", String(Date.now()));

    const store = makeCounterStore();
    renderHook(() => useStorePersistence("counter", store), { wrapper: wrapperFor(sdk) });
    await waitFor(() => expect(store.getState().count).toBe(3));
  });

  it("writes the mirror synchronously, before any await", async () => {
    const sdk = createGnomputerSDK({ dbName: DB_NAME });
    // Seed a value so hydration is observable — the store's default is 0,
    // so waiting for 0 would prove nothing about whether hydration ran.
    await sdk.uiState.set("counter", JSON.stringify({ count: 5 }));

    const store = makeCounterStore();
    renderHook(() => useStorePersistence("counter", store), { wrapper: wrapperFor(sdk) });
    await waitFor(() => expect(store.getState().count).toBe(5));

    store.getState().setCount(7);
    // Read immediately — no await. That is the entire point: this value
    // survives a navigation that would abort the IndexedDB write.
    const raw = localStorage.getItem("gnomputer:mirror:counter");
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).value).toContain("7");
  });
});

describe("useStorePersistence when storage throws", () => {
  /** Not "returns null" — actually throws. A browser that blocks IndexedDB
   * outright, a quota error, private mode. Surfaced by a Help app test whose
   * fake SDK was harsher than the real one, and it found a real hole: the
   * read was unguarded, so the rejection went unhandled AND `hydrated` stayed
   * false forever — which gates writing as well as restoring, so one failed
   * read quietly disabled persistence for the whole session (AUD-006). */
  function throwingSdk() {
    return {
      uiState: {
        get: async () => {
          throw new Error("storage unavailable");
        },
        set: async () => {
          throw new Error("storage unavailable");
        },
        keys: async () => {
          throw new Error("storage unavailable");
        },
        remove: async () => {},
      },
    } as unknown as ReturnType<typeof createGnomputerSDK>;
  }

  it("still reports hydrated, so writing is not disabled for the session", async () => {
    const store = makeCounterStore();
    const { result } = renderHook(() => useStorePersistence("counter", store), {
      wrapper: wrapperFor(throwingSdk()),
    });

    await waitFor(() => expect(result.current).toBe(true));
  });

  it("leaves the store at its defaults rather than crashing", async () => {
    const store = makeCounterStore();
    renderHook(() => useStorePersistence("counter", store), {
      wrapper: wrapperFor(throwingSdk()),
    });

    await waitFor(() => expect(store.getState().count).toBe(0));
  });
});
