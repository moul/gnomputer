import { create } from "zustand";

// Keys match the section ids used in realm-browser.tsx's RealmBrowserHome —
// "recently-active" | "recently-added" | "staff-picks" | "system-realms".
interface BrowserHomeState {
  collapsed: Record<string, boolean>;
  toggleSection: (key: string) => void;
}

export const useBrowserHomeStore = create<BrowserHomeState>((set) => ({
  collapsed: {},
  toggleSection: (key) =>
    set((state) => ({ collapsed: { ...state.collapsed, [key]: !state.collapsed[key] } })),
}));
