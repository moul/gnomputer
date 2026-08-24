import { create } from "zustand";

export type RealmLens =
  | "render"
  | "source"
  | "docs"
  | "state"
  | "state-explorer"
  | "history"
  | "actions"
  | "graph"
  | "raw";

const REALM_LENSES: readonly RealmLens[] = [
  "render",
  "source",
  "docs",
  "state",
  "state-explorer",
  "history",
  "actions",
  "graph",
  "raw",
];

/** Narrows an unknown (a URL query value) to a lens we can actually render. */
export function isRealmLens(value: unknown): value is RealmLens {
  return typeof value === "string" && (REALM_LENSES as readonly string[]).includes(value);
}

export interface RealmTab {
  id: string;
  packagePath: string;
  renderPath: string;
  lens: RealmLens;
}

interface RealmWindowTabs {
  tabs: RealmTab[];
  activeTabId: string;
}

function makeHomeTab(id: string): RealmTab {
  return { id, packagePath: "", renderPath: "", lens: "render" };
}

/** Highest numeric suffix on an `id` of the form `<prefix><n>`, or -1. Used to
 * keep the id counters ahead of any set installed from storage. */
function maxSuffix(id: string, prefix: string): number {
  const n = Number(id.slice(prefix.length));
  return Number.isFinite(n) ? n : -1;
}

interface RealmTabsState {
  windows: Record<string, RealmWindowTabs>;
  extraWindowIds: string[];
  nextTabSeq: number;
  nextWindowSeq: number;
  /** Windows whose active tab was named by the URL on this load. Restoration
   * is async and merges saved windows over the store, so without knowing
   * this it would overwrite a tab a shared link had just set. */
  urlSeeded: Record<string, true>;

  ensureWindow: (windowId: string) => void;
  /** Records that a link, not restoration, decided this window's realm. */
  markUrlSeeded: (windowId: string) => void;
  /** Swaps the whole tab set at once, for switching to another network's
   * saved tabs. A realm path only means something on the chain it was
   * opened against, so these do not carry over. */
  replaceAll: (windows: Record<string, RealmWindowTabs>, extraWindowIds: string[]) => void;
  /** Sends every open window back to its Home tab, keeping the windows
   * themselves. For switching to a network that has nothing saved: closing
   * the windows outright would be a bigger surprise than emptying them. */
  resetTabsToHome: () => void;
  openTab: (windowId: string, seed?: Partial<Omit<RealmTab, "id">>) => void;
  closeTab: (windowId: string, tabId: string) => void;
  setActiveTab: (windowId: string, tabId: string) => void;
  updateActiveTab: (windowId: string, patch: Partial<Omit<RealmTab, "id">>) => void;
  popOutActiveTab: (windowId: string) => string | null;
  /** Spawns a fresh standalone window with a single Home tab, independent
   * of any existing window's state — used by the Apps start-menu launcher
   * for a multi-window app, where there's no "current tab" to seed from. */
  createNewWindow: () => string;
  removeWindow: (windowId: string) => void;
}

export const useRealmTabsStore = create<RealmTabsState>((set, get) => ({
  windows: {},
  extraWindowIds: [],
  nextTabSeq: 1,
  nextWindowSeq: 1,
  urlSeeded: {},

  markUrlSeeded: (windowId) => {
    if (get().urlSeeded[windowId]) return;
    set((state) => ({ urlSeeded: { ...state.urlSeeded, [windowId]: true } }));
  },

  replaceAll: (windows, extraWindowIds) => {
    // Same reconciliation restoration does: the id counters are not part of
    // what is stored, so they would reset low and could mint an id that
    // collides with one in the set being installed.
    let nextTabSeq = get().nextTabSeq;
    let nextWindowSeq = get().nextWindowSeq;
    for (const win of Object.values(windows)) {
      for (const tab of win.tabs) {
        nextTabSeq = Math.max(nextTabSeq, maxSuffix(tab.id, "tab-") + 1);
      }
    }
    for (const id of extraWindowIds) {
      nextWindowSeq = Math.max(nextWindowSeq, maxSuffix(id, "realm-") + 1);
    }
    // urlSeeded is cleared with the tabs: it records that a link decided the
    // realm for *this* chain's tabs, and those are being replaced.
    set({ windows, extraWindowIds, nextTabSeq, nextWindowSeq, urlSeeded: {} });
  },

  resetTabsToHome: () => {
    let seq = get().nextTabSeq;
    const windows: Record<string, RealmWindowTabs> = {};
    for (const windowId of Object.keys(get().windows)) {
      const homeTab = makeHomeTab(`tab-${seq}`);
      seq += 1;
      windows[windowId] = { tabs: [homeTab], activeTabId: homeTab.id };
    }
    set({ windows, nextTabSeq: seq, urlSeeded: {} });
  },

  ensureWindow: (windowId) => {
    if (get().windows[windowId]) return;
    const seq = get().nextTabSeq;
    const tabId = `tab-${seq}`;
    set((state) => ({
      nextTabSeq: seq + 1,
      windows: { ...state.windows, [windowId]: { tabs: [makeHomeTab(tabId)], activeTabId: tabId } },
    }));
  },

  openTab: (windowId, seed) => {
    const win = get().windows[windowId];
    if (!win) return;
    const seq = get().nextTabSeq;
    const tabId = `tab-${seq}`;
    const tab: RealmTab = { id: tabId, packagePath: "", renderPath: "", lens: "render", ...seed };
    set((state) => ({
      nextTabSeq: seq + 1,
      windows: { ...state.windows, [windowId]: { tabs: [...win.tabs, tab], activeTabId: tabId } },
    }));
  },

  closeTab: (windowId, tabId) => {
    const win = get().windows[windowId];
    if (!win) return;
    const idx = win.tabs.findIndex((t) => t.id === tabId);
    if (idx === -1) return;

    if (win.tabs.length === 1) {
      // Never leave a window with zero tabs — reset to a fresh Home tab
      // instead, mirroring what closing the last browser tab of a window
      // does (the window itself stays, showing a blank/home state).
      const seq = get().nextTabSeq;
      const homeTab = makeHomeTab(`tab-${seq}`);
      set((state) => ({
        nextTabSeq: seq + 1,
        windows: { ...state.windows, [windowId]: { tabs: [homeTab], activeTabId: homeTab.id } },
      }));
      return;
    }

    const tabs = win.tabs.filter((t) => t.id !== tabId);
    const activeTabId =
      win.activeTabId === tabId ? tabs[Math.min(idx, tabs.length - 1)]!.id : win.activeTabId;
    set((state) => ({ windows: { ...state.windows, [windowId]: { tabs, activeTabId } } }));
  },

  setActiveTab: (windowId, tabId) => {
    const win = get().windows[windowId];
    if (!win || !win.tabs.some((t) => t.id === tabId)) return;
    set((state) => ({ windows: { ...state.windows, [windowId]: { ...win, activeTabId: tabId } } }));
  },

  updateActiveTab: (windowId, patch) => {
    const win = get().windows[windowId];
    if (!win) return;
    set((state) => ({
      windows: {
        ...state.windows,
        [windowId]: {
          ...win,
          tabs: win.tabs.map((t) => (t.id === win.activeTabId ? { ...t, ...patch } : t)),
        },
      },
    }));
  },

  popOutActiveTab: (windowId) => {
    const win = get().windows[windowId];
    if (!win) return null;
    const activeTab = win.tabs.find((t) => t.id === win.activeTabId);
    if (!activeTab) return null;

    const winSeq = get().nextWindowSeq;
    const newWindowId = `realm-${winSeq}`;
    let tabSeq = get().nextTabSeq;
    const newTab: RealmTab = { ...activeTab, id: `tab-${tabSeq}` };
    tabSeq += 1;

    let sourceTabs = win.tabs.filter((t) => t.id !== activeTab.id);
    let sourceActiveId: string;
    if (sourceTabs.length === 0) {
      const homeTab = makeHomeTab(`tab-${tabSeq}`);
      tabSeq += 1;
      sourceTabs = [homeTab];
      sourceActiveId = homeTab.id;
    } else {
      sourceActiveId = sourceTabs[0]!.id;
    }

    set((state) => ({
      nextWindowSeq: winSeq + 1,
      nextTabSeq: tabSeq,
      extraWindowIds: [...state.extraWindowIds, newWindowId],
      windows: {
        ...state.windows,
        [windowId]: { tabs: sourceTabs, activeTabId: sourceActiveId },
        [newWindowId]: { tabs: [newTab], activeTabId: newTab.id },
      },
    }));
    return newWindowId;
  },

  createNewWindow: () => {
    const winSeq = get().nextWindowSeq;
    const newWindowId = `realm-${winSeq}`;
    const tabSeq = get().nextTabSeq;
    const homeTab = makeHomeTab(`tab-${tabSeq}`);
    set((state) => ({
      nextWindowSeq: winSeq + 1,
      nextTabSeq: tabSeq + 1,
      extraWindowIds: [...state.extraWindowIds, newWindowId],
      windows: { ...state.windows, [newWindowId]: { tabs: [homeTab], activeTabId: homeTab.id } },
    }));
    return newWindowId;
  },

  removeWindow: (windowId) => {
    set((state) => {
      const windows = { ...state.windows };
      delete windows[windowId];
      return { windows, extraWindowIds: state.extraWindowIds.filter((id) => id !== windowId) };
    });
  },
}));
