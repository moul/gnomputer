import { useEffect, useRef } from "react";
import { useSdk } from "../sdk-context";
import { useWindowStore, type WindowRecord } from "./window-store";

export function useWindowPersistence(storageKey: string) {
  const sdk = useSdk();
  const hydrated = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const raw = await sdk.uiState.get(storageKey);
      if (cancelled) return;
      if (raw) {
        try {
          const saved = JSON.parse(raw) as Record<string, WindowRecord>;
          // Windows mounted before this async load resolved already ran
          // ensureWindow() with their hardcoded defaults — the saved layout
          // must win for any id it covers, so it goes second in the spread.
          useWindowStore.setState((state) => {
            const windows = { ...state.windows, ...saved };
            // topZIndex itself isn't persisted, so it resets low on every
            // reload — if a restored window's zIndex is higher than that
            // reset value, focus() would compute a "next" zIndex that's
            // still lower than some other (untouched) window's restored
            // one, permanently stranding focus on whatever had the highest
            // zIndex last session no matter what gets clicked afterward.
            const maxRestoredZ = Object.values(windows).reduce(
              (max, w) => Math.max(max, w.zIndex),
              0
            );
            return { windows, topZIndex: Math.max(state.topZIndex, maxRestoredZ) };
          });
        } catch {
          // Corrupt or outdated stored layout — fall back to defaults rather
          // than crash the desktop.
        }
      }
      hydrated.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [sdk, storageKey]);

  useEffect(() => {
    const unsubscribe = useWindowStore.subscribe((state) => {
      if (!hydrated.current) return;
      void sdk.uiState.set(storageKey, JSON.stringify(state.windows));
    });
    return unsubscribe;
  }, [sdk, storageKey]);
}
