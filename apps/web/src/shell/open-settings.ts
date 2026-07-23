import { useWindowStore } from "./window-store";
import { useSettingsUiStore, type SettingsTab } from "./settings-store";

export function openSettings(tab: SettingsTab) {
  useSettingsUiStore.getState().setActiveTab(tab);
  useWindowStore.getState().reopen("settings");
}
