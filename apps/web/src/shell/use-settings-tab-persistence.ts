import { useSettingsUiStore, isSettingsTab, type SettingsTab } from "./settings-store";
import { useStorePersistence } from "./use-store-persistence";

const STORAGE_KEY = "settings-active-tab";

function deserialize(raw: string): { activeTab: SettingsTab } | null {
  return isSettingsTab(raw) ? { activeTab: raw } : null;
}

export function useSettingsTabPersistence() {
  useStorePersistence(STORAGE_KEY, useSettingsUiStore, {
    serialize: (state) => state.activeTab,
    deserialize,
  });
}
