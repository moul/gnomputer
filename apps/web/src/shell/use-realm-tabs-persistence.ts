import { useEffect, useRef } from "react";
import { useSdk } from "../sdk-context";
import { useRealmTabsStore, type RealmTab, type RealmLens } from "./realm-tabs-store";

const STORAGE_KEY = "realm-tabs";

const REALM_LENSES: RealmLens[] = ["render", "source", "docs", "state", "history", "actions", "graph", "raw"];

interface PersistedRealmTabs {
  windows: Record<string, { tabs: RealmTab[]; activeTabId: string }>;
  extraWindowIds: string[];
}

export function isRealmTab(value: unknown): value is RealmTab {
  if (typeof value !== "object" || value === null) return false;
  const t = value as Record<string, unknown>;
  return (
    typeof t.id === "string" &&
    typeof t.packagePath === "string" &&
    typeof t.renderPath === "string" &&
    typeof t.lens === "string" &&
    (REALM_LENSES as string[]).includes(t.lens)
  );
}

/** Keeps only entries whose shape still matches what this app version
 * expects — an old/renamed field from a previous schema falls back to
 * defaults for just that entry rather than crashing the desktop or
 * restoring a half-valid tab set. */
export function filterValidRealmTabWindows(parsed: unknown): PersistedRealmTabs["windows"] {
  if (typeof parsed !== "object" || parsed === null) return {};
  const entries = Object.entries(parsed as Record<string, unknown>).filter(([, v]) => {
    if (typeof v !== "object" || v === null) return false;
    const win = v as Record<string, unknown>;
    return typeof win.activeTabId === "string" && Array.isArray(win.tabs) && win.tabs.every(isRealmTab);
  });
  return Object.fromEntries(entries) as PersistedRealmTabs["windows"];
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
          const parsed: unknown = JSON.parse(raw);
          const savedWindows = filterValidRealmTabWindows((parsed as Partial<PersistedRealmTabs>)?.windows);
          const savedExtraIds = (parsed as Partial<PersistedRealmTabs>)?.extraWindowIds;
          useRealmTabsStore.setState((state) => {
            const windows = { ...state.windows, ...savedWindows };
            const extraWindowIds =
              Array.isArray(savedExtraIds) && savedExtraIds.every((id) => typeof id === "string")
                ? savedExtraIds
                : state.extraWindowIds;
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
