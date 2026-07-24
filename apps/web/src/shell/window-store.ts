import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";

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

export type TileMode = "grid-row" | "grid-col" | "cascade" | "random";
export const TILE_MODES: TileMode[] = ["grid-row", "grid-col", "cascade", "random"];
export const TILE_MODE_LABELS: Record<TileMode, string> = {
  "grid-row": "Grid (rows)",
  "grid-col": "Grid (columns)",
  cascade: "Cascade",
  random: "Random",
};

interface WindowManagerState {
  windows: Record<string, WindowRecord>;
  topZIndex: number;
  tileMode: TileMode;
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
  /** Applies one specific layout without changing tileMode — used when
   * restoring/re-applying the current mode. */
  applyTile: (mode: TileMode, bounds: { width: number; height: number }) => void;
  /** Advances to the next TileMode and applies it — what the taskbar's
   * [##] button calls each click. */
  cycleTile: (bounds: { width: number; height: number }) => void;
}

const MIN_WIDTH = 280;
const MIN_HEIGHT = 180;
const TILE_GAP = 12;
const CASCADE_SCALE = 0.65;
const CASCADE_STEP = 32;
const RANDOM_SCALE = 0.6;

export const useWindowStore = create<WindowManagerState>((set, get) => ({
  windows: {},
  topZIndex: 1,
  tileMode: "grid-row",

  ensureWindow: (id, title, defaults, options) => {
    const existing = get().windows[id];
    if (existing) {
      if (existing.title !== title) {
        set((state) => ({ windows: { ...state.windows, [id]: { ...existing, title } } }));
      }
      return;
    }
    const nextZ = get().topZIndex + 1;
    set((state) => ({
      topZIndex: nextZ,
      windows: {
        ...state.windows,
        [id]: {
          ...defaults,
          title,
          zIndex: nextZ,
          closed: options?.startClosed ?? false,
          minimized: false,
          maximized: options?.startMaximized ?? false,
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

  applyTile: (mode, bounds) => {
    const entries = Object.entries(get().windows).filter(([, w]) => !w.closed && !w.minimized);
    if (entries.length === 0) return;
    const n = entries.length;

    if (mode === "grid-row" || mode === "grid-col") {
      const primary = Math.ceil(Math.sqrt(n));
      const secondary = Math.ceil(n / primary);
      // grid-row: primary axis is columns (fills a row left-to-right first).
      // grid-col: primary axis is rows (fills a column top-to-bottom first).
      const cols = mode === "grid-row" ? primary : secondary;
      const rows = mode === "grid-row" ? secondary : primary;
      const cellWidth = Math.max(MIN_WIDTH, (bounds.width - TILE_GAP * (cols + 1)) / cols);
      const cellHeight = Math.max(MIN_HEIGHT, (bounds.height - TILE_GAP * (rows + 1)) / rows);
      set((state) => {
        const windows = { ...state.windows };
        entries.forEach(([id], i) => {
          // grid-row fills across then down; grid-col fills down then across.
          const col = mode === "grid-row" ? i % cols : Math.floor(i / rows);
          const row = mode === "grid-row" ? Math.floor(i / cols) : i % rows;
          windows[id] = {
            ...windows[id]!,
            maximized: false,
            preMaximizeGeometry: null,
            x: TILE_GAP + col * (cellWidth + TILE_GAP),
            y: TILE_GAP + row * (cellHeight + TILE_GAP),
            width: cellWidth,
            height: cellHeight,
          };
        });
        return { windows };
      });
      return;
    }

    if (mode === "cascade") {
      const width = Math.max(MIN_WIDTH, bounds.width * CASCADE_SCALE);
      const height = Math.max(MIN_HEIGHT, bounds.height * CASCADE_SCALE);
      const maxStepsX = Math.max(1, Math.floor((bounds.width - width) / CASCADE_STEP));
      const maxStepsY = Math.max(1, Math.floor((bounds.height - height) / CASCADE_STEP));
      const maxSteps = Math.max(1, Math.min(maxStepsX, maxStepsY));
      set((state) => {
        const windows = { ...state.windows };
        entries.forEach(([id], i) => {
          const step = i % maxSteps;
          windows[id] = {
            ...windows[id]!,
            maximized: false,
            preMaximizeGeometry: null,
            x: step * CASCADE_STEP,
            y: step * CASCADE_STEP,
            width,
            height,
          };
        });
        return { windows };
      });
      return;
    }

    // random — bounded so every window still fits fully within the desktop,
    // not scattered off-screen.
    const width = Math.max(MIN_WIDTH, Math.min(bounds.width * RANDOM_SCALE, bounds.width - 20));
    const height = Math.max(MIN_HEIGHT, Math.min(bounds.height * RANDOM_SCALE, bounds.height - 20));
    const maxX = Math.max(0, bounds.width - width);
    const maxY = Math.max(0, bounds.height - height);
    set((state) => {
      const windows = { ...state.windows };
      entries.forEach(([id]) => {
        windows[id] = {
          ...windows[id]!,
          maximized: false,
          preMaximizeGeometry: null,
          x: Math.round(Math.random() * maxX),
          y: Math.round(Math.random() * maxY),
          width,
          height,
        };
      });
      return { windows };
    });
  },

  cycleTile: (bounds) => {
    const nextMode = TILE_MODES[(TILE_MODES.indexOf(get().tileMode) + 1) % TILE_MODES.length]!;
    set({ tileMode: nextMode });
    get().applyTile(nextMode, bounds);
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
