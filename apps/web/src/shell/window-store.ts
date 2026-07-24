import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { desktopBounds, clientToDesktopLocal } from "./desktop-bounds";
import { ISLAND_CLEARANCE_PX } from "./viewport";

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
  minimized: boolean;
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
    options?: { startClosed?: boolean; startMaximized?: boolean }
  ) => void;
  focus: (id: string) => void;
  move: (id: string, x: number, y: number) => void;
  resize: (id: string, width: number, height: number) => void;
  close: (id: string) => void;
  /** Closes every currently-open window at once (overview mode's "close all
   * windows" button) — leaves closed/minimized windows untouched. */
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
  minimize: (id: string) => void;
  restore: (id: string) => void;
  toggleMaximize: (id: string, bounds: { width: number; height: number }) => void;
}

const MIN_WIDTH = 280;
const MIN_HEIGHT = 180;
// How far a freshly-opened window's position wanders from dead-center, as a
// fraction of the available slack on each axis — enough to keep several
// windows from landing exactly on top of each other, not so much that a new
// window can show up off in a corner.
const CENTER_JITTER_RATIO = 0.25;

// Never place a window's top edge above the island bar. Shared by every
// placement strategy below (centered-random, near-click) so none of them can
// tuck a window under the island or off the edge of the desktop.
function clampWindowOrigin(x: number, y: number, size: { width: number; height: number }): { x: number; y: number } {
  const bounds = desktopBounds();
  const maxX = Math.max(0, bounds.width - size.width);
  const minY = Math.min(ISLAND_CLEARANCE_PX, Math.max(0, bounds.height - size.height));
  const maxY = Math.max(minY, bounds.height - size.height);
  return {
    x: Math.round(Math.min(maxX, Math.max(0, x))),
    y: Math.round(Math.min(maxY, Math.max(minY, y))),
  };
}

function centeredRandomPosition(size: { width: number; height: number }): { x: number; y: number } {
  const bounds = desktopBounds();
  const maxX = Math.max(0, bounds.width - size.width);
  const minY = Math.min(ISLAND_CLEARANCE_PX, Math.max(0, bounds.height - size.height));
  const maxY = Math.max(minY, bounds.height - size.height);

  const centerX = maxX / 2;
  const centerY = minY + (maxY - minY) / 2;
  const jitterX = (Math.random() - 0.5) * maxX * CENTER_JITTER_RATIO;
  const jitterY = (Math.random() - 0.5) * (maxY - minY) * CENTER_JITTER_RATIO;

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

  toggleOverview: () => set((s) => ({ overviewOpen: !s.overviewOpen })),
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
    // Every window lands somewhere different by default instead of a fixed
    // curated spot — random placement plus overview mode (click the desktop
    // background) replaces needing to remember/tile a specific layout.
    // Maximized windows ignore position entirely, so skip the randomization.
    const position = startMaximized ? { x: defaults.x, y: defaults.y } : centeredRandomPosition(defaults);
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
          minimized: false,
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
    set((state) => ({
      windows: { ...state.windows, [id]: { ...win, x: Math.max(0, x), y: Math.max(0, y) } },
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
        [id]: { ...state.windows[id]!, closed: false, minimized: false },
      },
    }));
  },

  minimize: (id) => {
    const win = get().windows[id];
    if (!win) return;
    set((state) => ({ windows: { ...state.windows, [id]: { ...win, minimized: true } } }));
  },

  restore: (id) => {
    const win = get().windows[id];
    if (!win) return;
    get().focus(id);
    set((state) => ({ windows: { ...state.windows, [id]: { ...win, minimized: false } } }));
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
        if (w.closed || w.minimized) continue;
        if (!top || w.zIndex > top.zIndex) top = { id, title: w.title, zIndex: w.zIndex };
      }
      return top ? { id: top.id, title: top.title } : null;
    })
  );
}
