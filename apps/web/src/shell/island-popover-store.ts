import { create } from "zustand";

// Shared across every IslandPopover instance so hovering a second island
// icon always closes whichever popover was already open first, instead of
// two menus stacking up while the first one's own close-grace-period is
// still running (island-popover.tsx).
interface IslandPopoverState {
  openId: string | null;
  setOpenId: (id: string | null) => void;
}

export const useIslandPopoverStore = create<IslandPopoverState>((set) => ({
  openId: null,
  setOpenId: (id) => set({ openId: id }),
}));
