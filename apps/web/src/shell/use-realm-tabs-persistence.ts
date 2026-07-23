import { useEffect, useRef } from "react";
import { useSdk } from "../sdk-context";
import { useRealmTabsStore, type RealmTab } from "./realm-tabs-store";

const STORAGE_KEY = "realm-tabs";

interface PersistedRealmTabs {
  windows: Record<string, { tabs: RealmTab[]; activeTabId: string }>;
  extraWindowIds: string[];
}

function maxSuffix(id: string, prefix: string): number {
  const n = Number(id.slice(prefix.length));
  return Number.isFinite(n) ? n : -1;
}

export function useRealmTabsPersistence() {
  const sdk = useSdk();
  const hydrated = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const raw = await sdk.uiState.get(STORAGE_KEY);
      if (!cancelled && raw) {
        try {
          const saved = JSON.parse(raw) as PersistedRealmTabs;
          useRealmTabsStore.setState((state) => {
            const windows = { ...state.windows, ...saved.windows };
            const extraWindowIds = saved.extraWindowIds ?? state.extraWindowIds;
            // Same class of bug as window zIndex: the tab/window id sequence
            // counters aren't part of what's restored, so they'd reset low
            // and could mint an id that collides with one still present in
            // the restored data — reconcile against the highest seen suffix.
            let nextTabSeq = state.nextTabSeq;
            let nextWindowSeq = state.nextWindowSeq;
            for (const win of Object.values(windows)) {
              for (const tab of win.tabs) {
                nextTabSeq = Math.max(nextTabSeq, maxSuffix(tab.id, "tab-") + 1);
              }
            }
            for (const id of extraWindowIds) {
              nextWindowSeq = Math.max(nextWindowSeq, maxSuffix(id, "realm-") + 1);
            }
            return { windows, extraWindowIds, nextTabSeq, nextWindowSeq };
          });
        } catch {
          // Corrupt or outdated stored layout — fall back to defaults rather
          // than crash the desktop.
        }
      }
      hydrated.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [sdk]);

  useEffect(() => {
    const unsubscribe = useRealmTabsStore.subscribe((state) => {
      if (!hydrated.current) return;
      void sdk.uiState.set(
        STORAGE_KEY,
        JSON.stringify({ windows: state.windows, extraWindowIds: state.extraWindowIds })
      );
    });
    return unsubscribe;
  }, [sdk]);
}
