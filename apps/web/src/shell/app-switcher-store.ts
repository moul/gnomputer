import { create } from "zustand";

interface AppSwitcherState {
  open: boolean;
  windowIds: string[];
  selectedIndex: number;
  /** Starts a switch, pre-selecting the second-most-recent window (index 1)
   * when there is one — the same "straight to the previous app" behavior
   * Cmd/Alt-Tab has, rather than re-selecting whatever's already focused. */
  begin: (windowIds: string[]) => void;
  advance: () => void;
  cancel: () => void;
}

export const useAppSwitcherStore = create<AppSwitcherState>((set, get) => ({
  open: false,
  windowIds: [],
  selectedIndex: 0,

  begin: (windowIds) => {
    if (windowIds.length === 0) return;
    set({ open: true, windowIds, selectedIndex: windowIds.length > 1 ? 1 : 0 });
  },

  advance: () => {
    const { windowIds, selectedIndex } = get();
    if (windowIds.length === 0) return;
    set({ selectedIndex: (selectedIndex + 1) % windowIds.length });
  },

  cancel: () => set({ open: false, windowIds: [], selectedIndex: 0 }),
}));
