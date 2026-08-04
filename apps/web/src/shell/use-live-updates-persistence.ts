import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLiveUpdatesStore, useRefetchOnReconnect } from "./live-updates-store";
import { useStorePersistence } from "./use-store-persistence";

const STORAGE_KEY = "low-data";

/** Remembers the low-data choice, and catches up on reconnect.
 *
 * The preference persists because someone who turned polling off to protect a
 * mobile allowance did not mean "until I reload". Being offline deliberately
 * does NOT persist: that is a fact about right now, and a stale copy of it
 * would keep the app paused after the network came back. */
export function useLiveUpdatesPersistence(): void {
  const queryClient = useQueryClient();

  useStorePersistence(STORAGE_KEY, useLiveUpdatesStore, {
    serialize: (state) => (state.lowData ? "1" : "0"),
    deserialize: (raw) => ({ lowData: raw === "1" }),
  });

  // Invalidating rather than refetching: this touches every live query at
  // once, and a background window should reload when it is next looked at
  // rather than all of them firing the moment the wifi returns.
  useRefetchOnReconnect(
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: ["chain-height"] });
      void queryClient.invalidateQueries({ queryKey: ["network-status"] });
    }, [queryClient])
  );
}
