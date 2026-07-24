import { ISLAND_CLEARANCE_PX } from "./viewport";

export interface OverviewEntry {
  id: string;
  width: number;
  height: number;
}

export interface OverviewRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const GAP = 24;
const SIDE_MARGIN = 24;
const TOP_MARGIN = ISLAND_CLEARANCE_PX + 24;
const BOTTOM_MARGIN = 24;

/** Tiles every open window into an evenly-spaced grid for overview/expose
 * mode — entries are expected pre-sorted (most relevant first; window.tsx
 * uses z-order) since that order determines reading-order cell placement.
 * Each window is scaled down (never up) to fit its cell while keeping its
 * own aspect ratio, then centered within it — real x/y/width/height numbers
 * so the caller can just animate .window's existing left/top/width/height
 * to these instead of snapping, no separate transform system needed. */
export function computeOverviewLayout(
  entries: OverviewEntry[],
  bounds: { width: number; height: number }
): Record<string, OverviewRect> {
  const n = entries.length;
  if (n === 0) return {};

  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const usableWidth = Math.max(0, bounds.width - SIDE_MARGIN * 2);
  const usableHeight = Math.max(0, bounds.height - TOP_MARGIN - BOTTOM_MARGIN);
  const cellWidth = (usableWidth - GAP * (cols - 1)) / cols;
  const cellHeight = (usableHeight - GAP * (rows - 1)) / rows;

  const result: Record<string, OverviewRect> = {};
  entries.forEach((entry, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cellX = SIDE_MARGIN + col * (cellWidth + GAP);
    const cellY = TOP_MARGIN + row * (cellHeight + GAP);
    const scale = Math.min(cellWidth / entry.width, cellHeight / entry.height, 1);
    const width = entry.width * scale;
    const height = entry.height * scale;
    result[entry.id] = {
      x: cellX + (cellWidth - width) / 2,
      y: cellY + (cellHeight - height) / 2,
      width,
      height,
    };
  });
  return result;
}
