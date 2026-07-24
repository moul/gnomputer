import { useWindowStore } from "./window-store";
import { desktopBounds } from "./desktop-bounds";
import { computeOverviewLayout, type OverviewRect } from "./overview-layout";

/** This window's target rect while overview mode is active, or null when
 * it isn't — window.tsx falls back to the window's real x/y/width/height
 * when null, and animates between the two via .window's CSS transition
 * (see shell.css) since both are just plain absolute-position numbers. */
export function useOverviewGeometry(id: string): OverviewRect | null {
  const overviewOpen = useWindowStore((s) => s.overviewOpen);
  const windows = useWindowStore((s) => s.windows);

  if (!overviewOpen) return null;

  const entries = Object.entries(windows)
    .filter(([, w]) => !w.closed)
    .sort((a, b) => b[1].zIndex - a[1].zIndex)
    .map(([entryId, w]) => ({ id: entryId, width: w.width, height: w.height }));

  const layout = computeOverviewLayout(entries, desktopBounds());
  return layout[id] ?? null;
}
