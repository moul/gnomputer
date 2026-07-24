import { create } from "zustand";

export type ThemeId =
  | "ascii-dark"
  | "ascii-light"
  | "modern-light"
  | "modern-dark"
  | "ascii-cypherpunk"
  | "modern-minimal";

export const THEME_ORDER: ThemeId[] = [
  "ascii-dark",
  "ascii-light",
  "modern-light",
  "modern-dark",
  "ascii-cypherpunk",
  "modern-minimal",
];

export const THEME_LABELS: Record<ThemeId, string> = {
  "ascii-dark": "ASCII · Dark",
  "ascii-light": "ASCII · Light",
  "modern-light": "Clean · Light",
  "modern-dark": "Clean · Dark",
  "ascii-cypherpunk": "Cypherpunk",
  "modern-minimal": "Minimal",
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
  theme: "ascii-light",
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
