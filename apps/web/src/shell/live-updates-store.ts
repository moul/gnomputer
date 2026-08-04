import { useEffect } from "react";
import { create } from "zustand";
import { useOnlineStatus } from "./use-online-status";

interface LiveUpdatesState {
  /** User-chosen: stop polling the chain until asked again.
   *
   * Every live view in the app is driven by one shared height poll
   * (use-chain-height.ts), so a single flag here stops the block feed, the
   * event feed, the transaction feed and the realm change-watch at once —
   * rather than each view growing its own pause button that only covers
   * itself (AUD-042). */
  lowData: boolean;
  setLowData: (lowData: boolean) => void;
}

export const useLiveUpdatesStore = create<LiveUpdatesState>((set) => ({
  lowData: false,
  setLowData: (lowData) => set({ lowData }),
}));

/** True when nothing should be polling right now, for either reason.
 *
 * Connectivity comes from the existing useOnlineStatus() rather than a second
 * copy of the same listeners. The two reasons stay distinguishable at the UI
 * layer on purpose: "I turned this off" and "the train went into a tunnel"
 * need different copy, and only one of them ends by itself.
 */
export function useLiveUpdatesPaused(): boolean {
  const lowData = useLiveUpdatesStore((s) => s.lowData);
  const online = useOnlineStatus();
  return lowData || !online;
}

/** Refetches when connectivity comes back.
 *
 * Re-enabling the shared poll is what makes every live view resume, but
 * react-query does not necessarily refetch the instant a query is re-enabled
 * — so without this, reconnecting could leave the app showing pre-tunnel data
 * with nothing indicating it had not caught up yet.
 *
 * Mounted once, in the shell.
 */
export function useRefetchOnReconnect(onReconnect: () => void): void {
  const online = useOnlineStatus();
  useEffect(() => {
    if (!online) return;
    onReconnect();
  }, [online, onReconnect]);
}
