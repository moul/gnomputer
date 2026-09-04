import { useCallback, useEffect, useState } from "react";
import { useSdk } from "../sdk-context";
import { FIRST_RUN_DISMISSED_KEY } from "./help-store";

/**
 * Whether this is somebody's first visit — the signal that opens Help
 * unprompted.
 *
 * Two questions, not one, because either alone gets it wrong. "Have they
 * dismissed the welcome?" misses someone who has used the app for months and
 * simply never clicked the button. "Do they have a saved desktop?" misses
 * someone who dismissed it and then cleared their layout.
 *
 * The layout half is asked BY PREFIX rather than by naming a key, and that
 * detail is load-bearing: the layout key carries a schema version and a
 * network id (`window-layout:home:v10:<networkId>`), so a hardcoded name goes
 * stale silently. It already had once — the check read `…:v9` long after v10
 * shipped, so it had been answering "first visit" for everyone, and only the
 * dismissal flag was still holding the welcome back.
 *
 * Returns null until the answer is known. Callers must treat null as "not
 * yet" rather than "no": defaulting to false would open Help for nobody, and
 * defaulting to true would flash it at every returning visitor while
 * IndexedDB is read.
 * @returns {boolean | null} true on a first visit, false otherwise, null while still reading
 */
export function useIsFirstVisit(): boolean | null {
  const sdk = useSdk();
  const [isFirst, setIsFirst] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [dismissed, layouts] = await Promise.all([
          sdk.uiState.get(FIRST_RUN_DISMISSED_KEY),
          sdk.uiState.keys("window-layout:"),
        ]);
        if (!cancelled) setIsFirst(!dismissed && layouts.length === 0);
      } catch {
        // Storage unavailable (private mode, quota, a browser that blocks
        // IndexedDB). Treated as a returning visitor: opening an unasked-for
        // window on every single load is far worse than never introducing
        // the app to someone whose browser cannot remember being introduced.
        if (!cancelled) setIsFirst(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sdk]);

  return isFirst;
}

/** Records that the welcome has been seen, so it does not open again.
 *
 * Stable across renders, so an effect may depend on it honestly instead of
 * omitting it and relying on a guard to stop the loop. */
export function useMarkVisited(): () => void {
  const sdk = useSdk();
  return useCallback(() => {
    void sdk.uiState.set(FIRST_RUN_DISMISSED_KEY, "1");
  }, [sdk]);
}
