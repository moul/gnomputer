import { useEffect, useRef } from "react";
import { useSdk } from "../sdk-context";
import { useThemeStore, type ThemeId, THEME_ORDER } from "./theme-store";

const STORAGE_KEY = "theme";

function isThemeId(value: string): value is ThemeId {
  return (THEME_ORDER as string[]).includes(value);
}

export function useThemePersistence() {
  const sdk = useSdk();
  const hydrated = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const saved = await sdk.uiState.get(STORAGE_KEY);
      if (!cancelled && saved && isThemeId(saved)) {
        useThemeStore.getState().setTheme(saved);
      }
      hydrated.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [sdk]);

  useEffect(() => {
    const unsubscribe = useThemeStore.subscribe((state) => {
      if (!hydrated.current) return;
      void sdk.uiState.set(STORAGE_KEY, state.theme);
    });
    return unsubscribe;
  }, [sdk]);
}
