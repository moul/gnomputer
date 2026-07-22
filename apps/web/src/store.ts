import { create } from "zustand";

interface ShellState {
  activeNetworkId: string;
  commandPaletteOpen: boolean;
  guestLabel: string;
  trailVersion: number;
  setCommandPaletteOpen: (open: boolean) => void;
  setActiveNetwork: (id: string) => void;
  bumpTrailVersion: () => void;
}

export const useShellStore = create<ShellState>((set) => ({
  activeNetworkId: "test13",
  commandPaletteOpen: false,
  guestLabel: "Browsing as guest",
  trailVersion: 0,
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setActiveNetwork: (id) => set({ activeNetworkId: id }),
  bumpTrailVersion: () => set((s) => ({ trailVersion: s.trailVersion + 1 })),
}));
