import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { desktopBounds, clientToDesktopLocal } from "./desktop-bounds";
import { ISLAND_CLEARANCE_PX, TITLEBAR_HEIGHT_PX } from "./viewport";

// However far a window is dragged (or left after the browser itself is
// resized), at least this fraction of its width must stay on-screen — an
// "invisible wall" so a window can never be shoved fully off the left/right
// edge and become unreachable. Paired with the titlebar-height clamp below
// (vertical) for a real desktop feel: windows can be dragged mostly off
// any edge, but never so far they can't be dragged back.
const MIN_VISIBLE_WIDTH_RATIO = 0.2;

export interface WindowGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowRecord extends WindowGeometry {
  title: string;
  zIndex: number;
  closed: boolean;
  maximized: boolean;
  preMaximizeGeometry: WindowGeometry | null;
}

interface WindowManagerState {
  windows: Record<string, WindowRecord>;
  topZIndex: number;
  /** True while the "show everything" overview grid (click the desktop
   * background to enter/exit) is active — see home.tsx and window.tsx. */
  overviewOpen: boolean;
  toggleOverview: () => void;
  closeOverview: () => void;
  ensureWindow: (
    id: string,
    title: string,
    defaults: WindowGeometry,
    options?: { startClosed?: boolean; startMaximized?: boolean; centeredPlacement?: boolean }
  ) => void;
  focus: (id: string) => void;
  move: (id: string, x: number, y: number) => void;
  resize: (id: string, width: number, height: number) => void;
  /** Re-applies clampWindowOrigin to every open, non-maximized window in
   * place — called when the browser viewport itself is resized, so a
   * window that was fully in-bounds before doesn't get left stranded off
   * the new, smaller edge (use-window-viewport-reclamp.ts). */
  reclampAll: () => void;
  /** Pulls every open, non-maximized window FULLY into the current viewport,
   * shrinking any that no longer fit. Distinct from reclampAll, which
   * applies the drag rule: that one deliberately allows a window to hang
   * off the edge as long as a sliver and its titlebar stay reachable,
   * because a user who parks a window half off-screen meant to. A restore
   * is not a user action, so a layout arriving from a bigger screen has to
   * land somewhere usable rather than merely grabbable. */
  fitAllIntoView: () => void;
  close: (id: string) => void;
  /** Closes every currently-open window at once (overview mode's "close all
   * windows" button) — leaves already-closed windows untouched. */
  closeAll: () => void;
  /** Deletes the window entirely rather than marking it closed — for
   * dynamically-created windows (e.g. a popped-out realm browser instance)
   * that shouldn't leave an orphaned entry behind once destroyed. */
  remove: (id: string) => void;
  reopen: (id: string) => void;
  /** Moves a window to open near a screen point (a link click's clientX/Y) —
   * used when a click opens/reopens a singleton window, so it lands under
   * the cursor instead of always dead-center. No-ops for a maximized window,
   * same as move(). */
  placeNear: (id: string, client: { x: number; y: number }) => void;
  toggleMaximize: (id: string, bounds: { width: number; height: number }) => void;
}

const MIN_WIDTH = 280;
const MIN_HEIGHT = 180;
// How far a freshly-opened window's position wanders from dead-center, as a
// fraction of the available slack on each axis — enough to keep several
// windows from landing exactly on top of each other, not so much that a new
// window can show up off in a corner.
const CENTER_JITTER_RATIO = 0.25;

// Two invisible walls, enforced everywhere a window's x/y is set (initial
// placement, drag, browser-resize reclamp): horizontally, at least
// MIN_VISIBLE_WIDTH_RATIO of the window's own width must stay on-screen on
// either axis of overhang; vertically, the top wall is the island's bottom
// edge (a window's titlebar can never go above/behind it) and the bottom
// wall is the viewport's own bottom edge minus the titlebar's height, so
// the titlebar — regardless of how tall the rest of the window is, or
// whether it runs off the bottom — always stays 100% visible and grabbable.
function clampWindowOrigin(x: number, y: number, size: { width: number; height: number }): { x: number; y: number } {
  const bounds = desktopBounds();
  const minVisibleWidth = size.width * MIN_VISIBLE_WIDTH_RATIO;
  const minX = minVisibleWidth - size.width;
  const maxX = bounds.width - minVisibleWidth;
  const maxY = Math.max(ISLAND_CLEARANCE_PX, bounds.height - TITLEBAR_HEIGHT_PX);
  return {
    x: Math.round(Math.min(maxX, Math.max(minX, x))),
    y: Math.round(Math.min(maxY, Math.max(ISLAND_CLEARANCE_PX, y))),
  };
}

function centeredRandomPosition(size: { width: number; height: number }): { x: number; y: number } {
  const bounds = desktopBounds();
  const maxX = Math.max(0, bounds.width - size.width);
  const maxY = Math.max(ISLAND_CLEARANCE_PX, bounds.height - size.height);

  const centerX = maxX / 2;
  const centerY = ISLAND_CLEARANCE_PX + (maxY - ISLAND_CLEARANCE_PX) / 2;
  const jitterX = (Math.random() - 0.5) * maxX * CENTER_JITTER_RATIO;
  const jitterY = (Math.random() - 0.5) * (maxY - ISLAND_CLEARANCE_PX) * CENTER_JITTER_RATIO;

  return clampWindowOrigin(centerX + jitterX, centerY + jitterY, size);
}

function nearClientPosition(client: { x: number; y: number }, size: { width: number; height: number }): {
  x: number;
  y: number;
} {
  const local = clientToDesktopLocal(client.x, client.y);
  // Center the window on the click rather than pinning its top-left corner
  // there, so it visually opens "at" the cursor instead of below-right of it.
  return clampWindowOrigin(local.x - size.width / 2, local.y - size.height / 2, size);
}

export const useWindowStore = create<WindowManagerState>((set, get) => ({
  windows: {},
  topZIndex: 1,
  overviewOpen: false,

  toggleOverview: () =>
    set((s) => {
      if (s.overviewOpen) return { overviewOpen: false };
      // Nothing to compare/expose with 0 or 1 window open — entering
      // overview would just show one tile (or none) with no point to it.
      const openCount = Object.values(s.windows).filter((w) => !w.closed).length;
      return openCount >= 2 ? { overviewOpen: true } : {};
    }),
  closeOverview: () => set({ overviewOpen: false }),

  ensureWindow: (id, title, defaults, options) => {
    const existing = get().windows[id];
    if (existing) {
      if (existing.title !== title) {
        set((state) => ({ windows: { ...state.windows, [id]: { ...existing, title } } }));
      }
      return;
    }
    const nextZ = get().topZIndex + 1;
    const startMaximized = options?.startMaximized ?? false;
    // Every window a user OPENS lands somewhere different by default
    // instead of a fixed curated spot — random placement plus overview mode
    // (click the desktop background) replaces needing to remember/tile a
    // specific layout. Maximized windows ignore position entirely, so skip
    // the randomization.
    //
    // centeredPlacement opts out. The window that makes up the initial
    // workspace uses it, so a first visit is the same every time rather
    // than landing a few dozen pixels away on each load — a launch state
    // that moves is not a launch state (AUD-009).
    const position =
      startMaximized || options?.centeredPlacement
        ? { x: defaults.x, y: defaults.y }
        : centeredRandomPosition(defaults);
    set((state) => ({
      topZIndex: nextZ,
      windows: {
        ...state.windows,
        [id]: {
          ...defaults,
          ...position,
          title,
          zIndex: nextZ,
          closed: options?.startClosed ?? false,
          maximized: startMaximized,
          preMaximizeGeometry: null,
        },
      },
    }));
  },

  focus: (id) => {
    const win = get().windows[id];
    if (!win) return;
    const nextZ = get().topZIndex + 1;
    set((state) => ({
      topZIndex: nextZ,
      windows: { ...state.windows, [id]: { ...win, zIndex: nextZ } },
    }));
  },

  move: (id, x, y) => {
    const win = get().windows[id];
    if (!win || win.maximized) return;
    const clamped = clampWindowOrigin(x, y, win);
    set((state) => ({
      windows: { ...state.windows, [id]: { ...win, ...clamped } },
    }));
  },

  resize: (id, width, height) => {
    const win = get().windows[id];
    if (!win || win.maximized) return;
    set((state) => ({
      windows: {
        ...state.windows,
        [id]: {
          ...win,
          width: Math.max(MIN_WIDTH, width),
          height: Math.max(MIN_HEIGHT, height),
        },
      },
    }));
  },

  close: (id) => {
    const win = get().windows[id];
    if (!win) return;
    set((state) => ({ windows: { ...state.windows, [id]: { ...win, closed: true } } }));
  },

  fitAllIntoView: () => {
    const bounds = desktopBounds();
    set((state) => ({
      windows: Object.fromEntries(
        Object.entries(state.windows).map(([id, w]) => {
          if (w.closed || w.maximized) return [id, w];
          const width = Math.max(MIN_WIDTH, Math.min(w.width, bounds.width));
          const height = Math.max(
            MIN_HEIGHT,
            Math.min(w.height, bounds.height - ISLAND_CLEARANCE_PX)
          );
          return [
            id,
            {
              ...w,
              width,
              height,
              x: Math.round(Math.min(Math.max(0, w.x), Math.max(0, bounds.width - width))),
              y: Math.round(
                Math.min(
                  Math.max(ISLAND_CLEARANCE_PX, w.y),
                  Math.max(ISLAND_CLEARANCE_PX, bounds.height - height)
                )
              ),
            },
          ];
        })
      ),
    }));
  },

  reclampAll: () => {
    const bounds = desktopBounds();
    set((state) => ({
      windows: Object.fromEntries(
        Object.entries(state.windows).map(([id, w]) => {
          if (w.closed || w.maximized) return [id, w];
          // Clamp SIZE as well as position. Previously only the origin was
          // reclamped, so a layout saved on a desktop and restored on a
          // phone kept windows far wider than the screen — the window was
          // dragged "in bounds" but most of it still hung off the edge
          // (AUD-008). Never grows a window, only shrinks one that no
          // longer fits.
          const width = Math.max(MIN_WIDTH, Math.min(w.width, bounds.width));
          const height = Math.max(
            MIN_HEIGHT,
            Math.min(w.height, bounds.height - ISLAND_CLEARANCE_PX)
          );
          const sized = { ...w, width, height };
          return [id, { ...sized, ...clampWindowOrigin(sized.x, sized.y, sized) }];
        })
      ),
    }));
  },

  placeNear: (id, client) => {
    const win = get().windows[id];
    if (!win || win.maximized) return;
    const { x, y } = nearClientPosition(client, win);
    set((state) => ({ windows: { ...state.windows, [id]: { ...win, x, y } } }));
  },

  closeAll: () => {
    set((state) => ({
      windows: Object.fromEntries(
        Object.entries(state.windows).map(([id, w]) => [id, w.closed ? w : { ...w, closed: true }])
      ),
    }));
  },

  remove: (id) => {
    set((state) => {
      const windows = { ...state.windows };
      delete windows[id];
      return { windows };
    });
  },

  reopen: (id) => {
    const win = get().windows[id];
    if (!win) return;
    get().focus(id);
    set((state) => ({
      windows: {
        ...state.windows,
        [id]: { ...state.windows[id]!, closed: false },
      },
    }));
  },

  toggleMaximize: (id, bounds) => {
    const win = get().windows[id];
    if (!win) return;
    get().focus(id);
    if (win.maximized) {
      const restored = win.preMaximizeGeometry ?? { x: 0, y: 0, width: win.width, height: win.height };
      set((state) => ({
        windows: {
          ...state.windows,
          [id]: { ...state.windows[id]!, ...restored, maximized: false, preMaximizeGeometry: null },
        },
      }));
    } else {
      // The visual fill is actually done by .window--maximized in CSS
      // (which also clears the island bar) — these numbers only matter as
      // the fallback size if this window is ever un-maximized without a
      // preMaximizeGeometry to restore (shouldn't normally happen, but
      // stay consistent with the CSS rather than overlapping the island).
      set((state) => ({
        windows: {
          ...state.windows,
          [id]: {
            ...state.windows[id]!,
            maximized: true,
            preMaximizeGeometry: { x: win.x, y: win.y, width: win.width, height: win.height },
            x: 0,
            y: ISLAND_CLEARANCE_PX,
            width: bounds.width,
            height: Math.max(MIN_HEIGHT, bounds.height - ISLAND_CLEARANCE_PX),
          },
        },
      }));
    }
  },

}));

export function useFocusedWindow(): { id: string; title: string } | null {
  return useWindowStore(
    useShallow((s) => {
      let top: { id: string; title: string; zIndex: number } | null = null;
      for (const [id, w] of Object.entries(s.windows)) {
        if (w.closed) continue;
        if (!top || w.zIndex > top.zIndex) top = { id, title: w.title, zIndex: w.zIndex };
      }
      return top ? { id: top.id, title: top.title } : null;
    })
  );
}
