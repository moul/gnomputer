import { create } from "zustand";
import { DEFAULT_NETWORK_ID } from "@gnomputer/app-sdk";

interface ShellState {
  activeNetworkId: string;
  commandPaletteOpen: boolean;
  guestLabel: string;
  trailVersion: number;
  /** Set while the pointer is over an island icon (island-bar.tsx) —
   * window.tsx highlights any matching window(s) so hovering an icon shows
   * you where its window(s) are. A group icon (e.g. "Chain") can point at
   * several member ids at once, hence an array rather than one id. */
  hoveredWindowIds: string[];
  setCommandPaletteOpen: (open: boolean) => void;
  setActiveNetwork: (id: string) => void;
  bumpTrailVersion: () => void;
  setHoveredWindowIds: (ids: string[]) => void;
}

export const useShellStore = create<ShellState>((set) => ({
  activeNetworkId: DEFAULT_NETWORK_ID,
  commandPaletteOpen: false,
  guestLabel: "Browsing as guest",
  trailVersion: 0,
  hoveredWindowIds: [],
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setActiveNetwork: (id) => set({ activeNetworkId: id }),
  bumpTrailVersion: () => set((s) => ({ trailVersion: s.trailVersion + 1 })),
  setHoveredWindowIds: (ids) => set({ hoveredWindowIds: ids }),
}));
