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
  /** False until the active network is the *real* one rather than a guess.
   *
   * `activeNetworkId` starts at `DEFAULT_NETWORK_ID` because the store is
   * built before the SDK is, so at boot it is a placeholder that may be
   * contradicted twice over — by a stored choice, and by the e2e override.
   * Anything that reads or writes storage under a per-network key has to wait
   * for this, or it works against the placeholder: a shared link opened while
   * a different chain was stored had its tabs flushed to the *default*
   * network's key, quietly overwriting that chain's saved desktop with a realm
   * that was never opened on it. */
  networkHydrated: boolean;
  /** True from the moment a switch is asked for until the new chain's desktop
   * has been restored. The whole desktop is torn down and rebuilt in between,
   * so this is what the boot overlay is shown against — otherwise the rebuild
   * reads as the app glitching rather than as changing chain. */
  networkSwitching: boolean;
  /** The window that was in front when a switch started, to be reopened on the
   * new chain's desktop. Each network has its own set of open windows, so
   * switching from inside one — Settings, most obviously, which is where the
   * network picker lives — would otherwise close the window being used. */
  carryWindowId: string | null;
  setCommandPaletteOpen: (open: boolean) => void;
  setShortcutsHelpOpen: (open: boolean) => void;
  setActiveNetwork: (id: string) => void;
  markNetworkHydrated: () => void;
  noteNetworkSwitch: () => void;
  setNetworkSwitching: (switching: boolean) => void;
  setCarryWindowId: (id: string | null) => void;
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
  networkHydrated: false,
  networkSwitching: false,
  carryWindowId: null,
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setShortcutsHelpOpen: (open) => set({ shortcutsHelpOpen: open }),
  setActiveNetwork: (id) => set({ activeNetworkId: id }),
  markNetworkHydrated: () => set({ networkHydrated: true }),
  noteNetworkSwitch: () => set((s) => ({ networkSwitchSeq: s.networkSwitchSeq + 1 })),
  setNetworkSwitching: (switching) => set({ networkSwitching: switching }),
  setCarryWindowId: (id) => set({ carryWindowId: id }),
  bumpTrailVersion: () => set((s) => ({ trailVersion: s.trailVersion + 1 })),
  setHoveredWindowIds: (ids) => set({ hoveredWindowIds: ids }),
}));
