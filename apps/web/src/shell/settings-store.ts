import { create } from "zustand";

export type SettingsTab = "network" | "user" | "about";

interface SettingsUiState {
  activeTab: SettingsTab;
  setActiveTab: (tab: SettingsTab) => void;
}

export const useSettingsUiStore = create<SettingsUiState>((set) => ({
  activeTab: "network",
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
