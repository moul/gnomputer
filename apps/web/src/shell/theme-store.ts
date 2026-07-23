import { create } from "zustand";

export type ThemeId = "ascii-dark" | "ascii-light" | "modern";

export const THEME_ORDER: ThemeId[] = ["ascii-dark", "ascii-light", "modern"];

export const THEME_LABELS: Record<ThemeId, string> = {
  "ascii-dark": "ASCII · Dark",
  "ascii-light": "ASCII · Light",
  modern: "Modern",
};

interface ThemeState {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  cycleTheme: () => void;
}

function applyTheme(theme: ThemeId) {
  document.documentElement.setAttribute("data-theme", theme);
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: "ascii-dark",
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },
  cycleTheme: () => {
    const current = get().theme;
    const next = THEME_ORDER[(THEME_ORDER.indexOf(current) + 1) % THEME_ORDER.length]!;
    get().setTheme(next);
  },
}));
