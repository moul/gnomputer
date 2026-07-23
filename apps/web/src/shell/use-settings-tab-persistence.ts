import { useEffect, useRef } from "react";
import { useSdk } from "../sdk-context";
import { useSettingsUiStore, type SettingsTab } from "./settings-store";

const STORAGE_KEY = "settings-active-tab";
const VALID_TABS: SettingsTab[] = ["network", "user", "about"];

function isSettingsTab(value: string): value is SettingsTab {
  return (VALID_TABS as string[]).includes(value);
}

export function useSettingsTabPersistence() {
  const sdk = useSdk();
  const hydrated = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const saved = await sdk.uiState.get(STORAGE_KEY);
      if (!cancelled && saved && isSettingsTab(saved)) {
        useSettingsUiStore.getState().setActiveTab(saved);
      }
      hydrated.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [sdk]);

  useEffect(() => {
    const unsubscribe = useSettingsUiStore.subscribe((state) => {
      if (!hydrated.current) return;
      void sdk.uiState.set(STORAGE_KEY, state.activeTab);
    });
    return unsubscribe;
  }, [sdk]);
}
