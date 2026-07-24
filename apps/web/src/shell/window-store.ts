import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { desktopBounds } from "./desktop-bounds";

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
  /** Deletes the window entirely rather than marking it closed — for
   * dynamically-created windows (e.g. a popped-out realm browser instance)
   * that shouldn't leave an orphaned entry behind once destroyed. */
  remove: (id: string) => void;
  reopen: (id: string) => void;
  minimize: (id: string) => void;
  restore: (id: string) => void;
  toggleMaximize: (id: string, bounds: { width: number; height: number }) => void;
}

const MIN_WIDTH = 280;
const MIN_HEIGHT = 180;

function randomPosition(size: { width: number; height: number }): { x: number; y: number } {
  const bounds = desktopBounds();
  const maxX = Math.max(0, bounds.width - size.width);
  const maxY = Math.max(0, bounds.height - size.height);
  return { x: Math.round(Math.random() * maxX), y: Math.round(Math.random() * maxY) };
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
    const position = startMaximized ? { x: defaults.x, y: defaults.y } : randomPosition(defaults);
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
      set((state) => ({
        windows: {
          ...state.windows,
          [id]: {
            ...state.windows[id]!,
            maximized: true,
            preMaximizeGeometry: { x: win.x, y: win.y, width: win.width, height: win.height },
            x: 0,
            y: 0,
            width: bounds.width,
            height: bounds.height,
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
