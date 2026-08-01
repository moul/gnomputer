import { useEffect, useState } from "react";
import { REMOTE_TIMEOUT_MS } from "./remote-content";

// Frequent enough to notice a new deploy within a session, not so frequent
// it's a meaningful load on whatever's serving version.json.
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

interface VersionFile {
  hash: string;
  buildTime: string;
}

/** The deployed version.json's contents once it reports a git hash
 * different from this tab's own __GIT_HASH__ (i.e. a newer build has been
 * deployed since this tab loaded), or null otherwise. Polls on an interval
 * and again whenever the tab regains focus, so a deploy that happened
 * while the tab was backgrounded is caught without waiting for the next
 * tick. Returns the new build's own hash/buildTime (not just a boolean) so
 * the update banner can show what's actually new, not just that something
 * is. */
export function useVersionCheck(): VersionFile | null {
  const [newVersion, setNewVersion] = useState<VersionFile | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const url = `${import.meta.env.BASE_URL}version.json?t=${Date.now()}`;
        // Deliberately not going through remote-content: this is
        // same-origin, purely informational, and swallows every failure, so
        // the adapter's typed errors would have nowhere to go. It does need
        // the deadline, though — on a polling interval, a request that never
        // settles leaks one pending fetch per tick, forever.
        const res = await fetch(url, {
          cache: "no-store",
          signal: AbortSignal.timeout(REMOTE_TIMEOUT_MS),
        });
        if (!res.ok) return;
        const data = (await res.json()) as VersionFile;
        if (!cancelled && data.hash && data.hash !== __GIT_HASH__) {
          setNewVersion(data);
        }
      } catch {
        // Offline or a transient network hiccup — this is purely
        // informational, so just try again on the next tick.
      }
    }

    void check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    function onVisibilityChange() {
      if (document.visibilityState === "visible") void check();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return newVersion;
}
