import { create } from "zustand";

export type RealmLens = "render" | "source" | "docs" | "state" | "history" | "actions" | "graph" | "raw";

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

interface RealmTabsState {
  windows: Record<string, RealmWindowTabs>;
  extraWindowIds: string[];
  nextTabSeq: number;
  nextWindowSeq: number;

  ensureWindow: (windowId: string) => void;
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
