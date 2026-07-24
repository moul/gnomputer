import { useEffect, useState } from "react";

// Frequent enough to notice a new deploy within a session, not so frequent
// it's a meaningful load on whatever's serving version.json.
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

interface VersionFile {
  hash: string;
}

/** True once version.json (vite.config.ts's writeVersionJson()) reports a
 * git hash different from this tab's own __GIT_HASH__ — i.e. a newer build
 * has been deployed since this tab loaded. Polls on an interval and again
 * whenever the tab regains focus, so a deploy that happened while the tab
 * was backgrounded is caught without waiting for the next tick. */
export function useVersionCheck(): boolean {
  const [newVersionAvailable, setNewVersionAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const url = `${import.meta.env.BASE_URL}version.json?t=${Date.now()}`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as VersionFile;
        if (!cancelled && data.hash && data.hash !== __GIT_HASH__) {
          setNewVersionAvailable(true);
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

  return newVersionAvailable;
}
