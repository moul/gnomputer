import { create } from "zustand";

interface ShellState {
  activeNetworkId: string;
  commandPaletteOpen: boolean;
  guestLabel: string;
  setCommandPaletteOpen: (open: boolean) => void;
  setActiveNetwork: (id: string) => void;
}

export const useShellStore = create<ShellState>((set) => ({
  activeNetworkId: "test13",
  commandPaletteOpen: false,
  guestLabel: "Browsing as guest",
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setActiveNetwork: (id) => set({ activeNetworkId: id }),
}));
