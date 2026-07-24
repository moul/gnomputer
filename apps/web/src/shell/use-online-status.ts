import { useEffect, useState } from "react";

/** The browser's own connectivity signal — immediate (no polling latency)
 * and a genuinely different thing from the RPC-reachability state
 * use-network-status.ts already tracks: this fires the instant the OS
 * reports the network interface itself is down, before any RPC call would
 * even have timed out. */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    function goOnline() {
      setOnline(true);
    }
    function goOffline() {
      setOnline(false);
    }
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}
