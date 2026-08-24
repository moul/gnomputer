import { create } from "zustand";
import { DEFAULT_NETWORK_ID } from "@gnomputer/app-sdk";

interface ShellState {
  activeNetworkId: string;
  commandPaletteOpen: boolean;
  shortcutsHelpOpen: boolean;
  guestLabel: string;
  trailVersion: number;
  /** Set while the pointer is over an island icon (island-bar.tsx) —
   * window.tsx highlights any matching window(s) so hovering an icon shows
   * you where its window(s) are. A group icon (e.g. "Chain") can point at
   * several member ids at once, hence an array rather than one id. */
  hoveredWindowIds: string[];
  /** Counts deliberate network switches — `activateNetwork()`, i.e. someone
   * picking another chain.
   *
   * `activeNetworkId` alone cannot stand in for this: it also changes while
   * the app settles at startup, from the default to whatever was stored (or
   * to the e2e override). Anything that must react to *switching* — dropping
   * the previous chain's tabs, for one — has to tell those two apart, or it
   * fires during boot and discards state the URL had just set. */
  networkSwitchSeq: number;
  setCommandPaletteOpen: (open: boolean) => void;
  setShortcutsHelpOpen: (open: boolean) => void;
  setActiveNetwork: (id: string) => void;
  noteNetworkSwitch: () => void;
  bumpTrailVersion: () => void;
  setHoveredWindowIds: (ids: string[]) => void;
}

export const useShellStore = create<ShellState>((set) => ({
  activeNetworkId: DEFAULT_NETWORK_ID,
  commandPaletteOpen: false,
  shortcutsHelpOpen: false,
  guestLabel: "Browsing as guest",
  trailVersion: 0,
  hoveredWindowIds: [],
  networkSwitchSeq: 0,
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setShortcutsHelpOpen: (open) => set({ shortcutsHelpOpen: open }),
  setActiveNetwork: (id) => set({ activeNetworkId: id }),
  noteNetworkSwitch: () => set((s) => ({ networkSwitchSeq: s.networkSwitchSeq + 1 })),
  bumpTrailVersion: () => set((s) => ({ trailVersion: s.trailVersion + 1 })),
  setHoveredWindowIds: (ids) => set({ hoveredWindowIds: ids }),
}));
