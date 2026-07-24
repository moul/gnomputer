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
    // afterward — give the hydration microtask a tick before changing state,
    // so this doesn't race the "if (!hydrated.current) return" guard.
    await new Promise((r) => setTimeout(r, 20));
    store.getState().setCount(7);

    await waitFor(async () => {
      const raw = await sdk.uiState.get("counter");
      expect(raw && JSON.parse(raw)).toMatchObject({ count: 7 });
    });
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
