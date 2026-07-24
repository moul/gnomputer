import { useEffect, useRef } from "react";
import { useSdk } from "../sdk-context";
import { useBrowserHomeStore } from "./browser-home-store";

const STORAGE_KEY = "browser-home-collapsed";

export function useBrowserHomePersistence() {
  const sdk = useSdk();
  const hydrated = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const saved = await sdk.uiState.get(STORAGE_KEY);
      if (!cancelled && saved) {
        try {
          const parsed = JSON.parse(saved) as Record<string, boolean>;
          useBrowserHomeStore.setState({ collapsed: parsed });
        } catch {
          // Corrupt stored value — fall back to every section expanded.
        }
      }
      hydrated.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [sdk]);

  useEffect(() => {
    const unsubscribe = useBrowserHomeStore.subscribe((state) => {
      if (!hydrated.current) return;
      void sdk.uiState.set(STORAGE_KEY, JSON.stringify(state.collapsed));
    });
    return unsubscribe;
  }, [sdk]);
}
