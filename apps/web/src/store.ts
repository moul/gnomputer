import { create } from "zustand";
import { DEFAULT_NETWORK_ID } from "@gnomputer/app-sdk";

interface ShellState {
  activeNetworkId: string;
  commandPaletteOpen: boolean;
  guestLabel: string;
  trailVersion: number;
  /** Set while the pointer is over a taskbar item — window.tsx highlights
   * the matching window so hovering the taskbar shows you where it is. */
  hoveredWindowId: string | null;
  setCommandPaletteOpen: (open: boolean) => void;
  setActiveNetwork: (id: string) => void;
  bumpTrailVersion: () => void;
  setHoveredWindowId: (id: string | null) => void;
}

export const useShellStore = create<ShellState>((set) => ({
  activeNetworkId: DEFAULT_NETWORK_ID,
  commandPaletteOpen: false,
  guestLabel: "Browsing as guest",
  trailVersion: 0,
  hoveredWindowId: null,
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setActiveNetwork: (id) => set({ activeNetworkId: id }),
  bumpTrailVersion: () => set((s) => ({ trailVersion: s.trailVersion + 1 })),
  setHoveredWindowId: (id) => set({ hoveredWindowId: id }),
}));
