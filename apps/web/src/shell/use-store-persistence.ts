import { useEffect, useRef } from "react";
import type { StoreApi, UseBoundStore } from "zustand";
import { useSdk } from "../sdk-context";

/** Generic version of use-window-persistence's load-then-subscribe pattern,
 * for any zustand store holding plain (JSON-serializable) data — action
 * functions in the state are untouched, since setState merges by default and
 * JSON.stringify silently drops function-valued keys. */
export function useStorePersistence<T extends object>(storageKey: string, store: UseBoundStore<StoreApi<T>>) {
  const sdk = useSdk();
  const hydrated = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const raw = await sdk.uiState.get(storageKey);
      if (cancelled) return;
      if (raw) {
        try {
          store.setState(JSON.parse(raw) as Partial<T>);
        } catch {
          // Corrupt or outdated stored state — fall back to defaults.
        }
      }
      hydrated.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [sdk, storageKey, store]);

  useEffect(() => {
    return store.subscribe((state) => {
      if (!hydrated.current) return;
      void sdk.uiState.set(storageKey, JSON.stringify(state));
    });
  }, [sdk, storageKey, store]);
}
