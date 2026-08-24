import { useEffect, useRef } from "react";
import { useSdk } from "../sdk-context";
import { useShellStore } from "../store";
import { syncUrlToActiveTab } from "./open-in-realm-tab";
import { useRealmTabsStore, type RealmTab, type RealmLens } from "./realm-tabs-store";

const STORAGE_KEY = "realm-tabs";

/**
 * Where one network's tabs live.
 *
 * Tabs are per-network because their contents are: a realm path identifies a
 * package on a particular chain, and the same path may be absent, or a
 * different package, on another. Keeping one global set meant switching chains
 * left the previous chain's realms on screen, queried against the new one.
 *
 * The unsuffixed key is left alone rather than migrated — it is one session's
 * open tabs, cheap to lose and confusing to attribute to a chain it may not
 * have belonged to.
 * @param {string} networkId the active network's id
 * @returns {string} the storage key for that network's tabs
 */
function storageKeyFor(networkId: string): string {
  return `${STORAGE_KEY}:${networkId}`;
}

/** Reads a stored tab set, tolerating anything that is not one. */
function parseSavedTabs(
  raw: string | null | undefined
): { windows: PersistedRealmTabs["windows"]; extraWindowIds: string[] } | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedRealmTabs>;
    const windows = filterValidRealmTabWindows(parsed?.windows);
    const ids = parsed?.extraWindowIds;
    return {
      windows,
      extraWindowIds:
        Array.isArray(ids) && ids.every((id) => typeof id === "string") ? ids : [],
    };
  } catch {
    // Corrupt or outdated stored layout — fall back to defaults rather than
    // crash the desktop.
    return null;
  }
}

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
  const networkId = useShellStore((s) => s.activeNetworkId);
  /** The key writes currently belong to. Held in a ref because the subscriber
   * below is registered once and must never write this network's tabs under
   * the key of the one being switched away from. */
  const activeKey = useRef(storageKeyFor(networkId));
  /** Which key has finished loading. Writes stay shut until it matches
   * `activeKey`, so an in-flight switch cannot persist a half-swapped set. */
  const hydratedKey = useRef<string | null>(null);
  const switchSeq = useShellStore((s) => s.networkSwitchSeq);
  const seenSwitchSeq = useRef(switchSeq);

  useEffect(() => {
    const key = storageKeyFor(networkId);
    // A switch is the deliberate act, not any change of id: `activeNetworkId`
    // also moves during boot, from the default to whatever was stored. Reading
    // that as a switch reset the tabs a link had just opened.
    const isSwitch = switchSeq !== seenSwitchSeq.current;
    seenSwitchSeq.current = switchSeq;
    activeKey.current = key;
    hydratedKey.current = null;

    let cancelled = false;
    void (async () => {
      const raw = await sdk.uiState.get(key);
      if (cancelled) return;
      const saved = parseSavedTabs(raw);

      if (isSwitch) {
        // Switching chains: the previous network's tabs are not merged, they
        // are replaced. A realm path names a package on one chain and may be
        // absent — or a different package — on another, so carrying tabs over
        // showed one chain's realms while querying the other's.
        if (saved) {
          useRealmTabsStore.getState().replaceAll(saved.windows, saved.extraWindowIds);
        } else {
          useRealmTabsStore.getState().resetTabsToHome();
        }
        // The URL still names the realm from the chain just left. The tabs are
        // now authoritative, so the address bar follows them rather than
        // re-applying a path that belongs to somewhere else.
        syncUrlToActiveTab("realm");
      } else if (saved) {
        useRealmTabsStore.setState((state) => {
          const windows = { ...state.windows };
          for (const [id, savedWindow] of Object.entries(saved.windows)) {
            // A link already named this window's realm. Restoring over it
            // would open the reader's own last-used realm under the linked
            // realm's title — the URL is the more specific intent, so it
            // wins and the rest of the saved layout still comes back.
            if (state.urlSeeded[id]) continue;
            windows[id] = savedWindow;
          }
          const extraWindowIds = saved.extraWindowIds.length
            ? saved.extraWindowIds
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
      }

      hydratedKey.current = key;

      // Whatever was applied before this point — most importantly the tab a
      // shared link named, which is set during the first render — was written
      // while the gate below was still shut, so it never reached storage.
      // Opening a link and coming back later lost that realm entirely. Flush
      // once now that restoration has had its say.
      const settled = useRealmTabsStore.getState();
      void sdk.uiState.set(
        key,
        JSON.stringify({ windows: settled.windows, extraWindowIds: settled.extraWindowIds })
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [sdk, networkId, switchSeq]);

  useEffect(() => {
    const unsubscribe = useRealmTabsStore.subscribe((state) => {
      // Both halves matter: nothing is written before this network's tabs have
      // loaded, and nothing is written to a key that is no longer the active
      // one — a change landing mid-switch would otherwise save the outgoing
      // chain's tabs under the incoming chain's key.
      if (hydratedKey.current === null || hydratedKey.current !== activeKey.current) return;
      void sdk.uiState.set(
        activeKey.current,
        JSON.stringify({ windows: state.windows, extraWindowIds: state.extraWindowIds })
      );
    });
    return unsubscribe;
  }, [sdk]);
}
