import { create } from "zustand";

export type SettingsTab = "network" | "user" | "theme" | "about";

const SETTINGS_TABS: SettingsTab[] = ["network", "user", "theme", "about"];

export function isSettingsTab(value: string): value is SettingsTab {
  return (SETTINGS_TABS as string[]).includes(value);
}

interface SettingsUiState {
  activeTab: SettingsTab;
  setActiveTab: (tab: SettingsTab) => void;
}

export const useSettingsUiStore = create<SettingsUiState>((set) => ({
  activeTab: "network",
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
