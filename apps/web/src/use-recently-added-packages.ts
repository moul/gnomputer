import { useEffect, useRef, useState } from "react";
import { useSdk } from "./sdk-context";

// Deployments are rare compared to regular chain activity — no need to poll
// anywhere near as often as live-events' 4s cadence.
const POLL_INTERVAL_MS = 30_000;
const PREFIX = "gno.land/";
const QPATHS_LIMIT = 5000;

/** Watches vm/qpaths for packages that weren't there on the previous poll —
 * a genuine "just deployed" signal (unlike rank-by-activity.ts, which only
 * catches packages that happen to emit an observable chain event). The
 * first poll only establishes a baseline; nothing is reported as "new"
 * relative to a baseline this session has never actually seen, so a
 * freshly-opened window doesn't claim every existing package as brand new. */
export function useRecentlyAddedPackages(active: boolean, limit = 10): string[] {
  const sdk = useSdk();
  const knownRef = useRef<Set<string> | null>(null);
  const [recentlyAdded, setRecentlyAdded] = useState<string[]>([]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function tick() {
      try {
        const env = await sdk.rpc.listPackagesByPrefix(PREFIX, QPATHS_LIMIT, new Date().toISOString());
        if (cancelled) return;
        if (knownRef.current === null) {
          knownRef.current = new Set(env.data);
        } else {
          const fresh = env.data.filter((p) => !knownRef.current!.has(p));
          if (fresh.length > 0) {
            setRecentlyAdded((prev) => [...fresh].reverse().concat(prev).slice(0, limit));
            knownRef.current = new Set(env.data);
          }
        }
      } catch {
        // Transient RPC hiccup — next tick tries again.
      } finally {
        if (!cancelled) timer = setTimeout(tick, POLL_INTERVAL_MS);
      }
    }

    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [sdk, active, limit]);

  return recentlyAdded;
}
