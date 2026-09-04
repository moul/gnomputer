import { Suspense, lazy, useEffect, useRef } from "react";
import { Window } from "./window";
import { useWindowStore } from "./window-store";
import { useHelpStore, parseHelpState } from "./help-store";
import { useStorePersistence } from "./use-store-persistence";
import { useIsFirstVisit, useMarkVisited } from "./use-first-visit";

// Its own chunk. Help is closed almost all the time, and its guide/action
// copy is the bulk of it — eager, it pushed the index chunk over budget by
// 0.2KB. The window shell below stays eager because reopen("help") needs the
// window registered whether or not the body has loaded yet, which is the same
// split home.tsx uses for every other app.
const HelpBody = lazy(() => import("./help-body").then((x) => ({ default: x.HelpBody })));

/** Search params that make a URL a destination rather than a front door.
 *
 * A link naming a realm, a lens or a network is somebody asking for THAT.
 * Opening a welcome window over it answers a question they did not ask, and
 * hides the thing the link was shared for — so a deep link wins, even on a
 * genuine first visit. The introduction is still one click away on the
 * island, and the visit is not marked as seen, so a later bare visit still
 * gets it.
 */
const DESTINATION_PARAMS = ["pkg", "path", "lens", "net"];

function urlNamesADestination(search: string): boolean {
  const params = new URLSearchParams(search);
  return DESTINATION_PARAMS.some((key) => (params.get(key) ?? "") !== "");
}

/**
 * The app that introduces the app.
 *
 * Replaces a dismissible note that appeared on a visitor's very first load
 * and then never again — so anything it failed to explain stayed unexplained,
 * and its three starters were unreachable forever after one stray click. As a
 * real window it opens itself once, closes like anything else, and comes back
 * from the island or ⌘K whenever the question returns.
 */
export function HelpWindow() {
  // Kept in the shell, not the body: progress has to survive the window being
  // closed, and a store hydrated only once the body mounts would read as empty
  // to anything asking earlier.
  useStorePersistence("ui-state:help", useHelpStore, {
    serialize: (s) => JSON.stringify({ done: s.done, showActions: s.showActions }),
    deserialize: parseHelpState,
  });

  const isFirstVisit = useIsFirstVisit();
  const markVisited = useMarkVisited();
  // Opened at most once per page load. Without this, closing the window on a
  // first visit and then having any state change re-run the effect would
  // reopen it — a window you cannot get rid of.
  const openedOnce = useRef(false);

  useEffect(() => {
    if (isFirstVisit !== true || openedOnce.current) return;
    if (urlNamesADestination(window.location.search)) return;
    openedOnce.current = true;
    // Recorded as soon as it is shown, not when it is dismissed: someone who
    // reloads instead of clicking has still been introduced, and greeting
    // them again on every load is the failure mode to avoid.
    markVisited();
    useWindowStore.getState().reopen("help");
  }, [isFirstVisit, markVisited]);

  return (
    <Window
      id="help"
      title="Help"
      accent="green"
      startClosed
      defaultGeometry={{ x: 200, y: 130, width: 470, height: 560 }}
    >
      <Suspense fallback={<p className="state-line">Loading…</p>}>
        <HelpBody />
      </Suspense>
    </Window>
  );
}
