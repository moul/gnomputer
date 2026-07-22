import { useEffect, useRef } from "react";
import { useSdk } from "../sdk-context";
import { useWindowStore } from "./window-store";

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
          const saved = JSON.parse(raw);
          // Windows mounted before this async load resolved already ran
          // ensureWindow() with their hardcoded defaults — the saved layout
          // must win for any id it covers, so it goes second in the spread.
          useWindowStore.setState((state) => ({ windows: { ...state.windows, ...saved } }));
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
