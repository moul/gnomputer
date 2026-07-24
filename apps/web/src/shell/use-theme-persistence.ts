import { useThemeStore, type ThemeId, THEME_ORDER } from "./theme-store";
import { useStorePersistence } from "./use-store-persistence";

const STORAGE_KEY = "theme";

function isThemeId(value: string): value is ThemeId {
  return (THEME_ORDER as string[]).includes(value);
}

function deserialize(raw: string): { theme: ThemeId } | null {
  return isThemeId(raw) ? { theme: raw } : null;
}

export function useThemePersistence() {
  useStorePersistence(STORAGE_KEY, useThemeStore, {
    serialize: (state) => state.theme,
    deserialize,
    // setTheme (not a raw setState) also applies the data-theme DOM
    // attribute — restoring via setState alone would update the store
    // without ever painting the restored theme.
    onRestore: (restored) => {
      if (restored.theme) useThemeStore.getState().setTheme(restored.theme);
    },
  });
}
