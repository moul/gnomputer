import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";

export interface WindowGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface WindowRecord extends WindowGeometry {
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
  ensureWindow: (
    id: string,
    title: string,
    defaults: WindowGeometry,
    options?: { startClosed?: boolean }
  ) => void;
  focus: (id: string) => void;
  move: (id: string, x: number, y: number) => void;
  resize: (id: string, width: number, height: number) => void;
  close: (id: string) => void;
  reopen: (id: string) => void;
  minimize: (id: string) => void;
  restore: (id: string) => void;
  toggleMaximize: (id: string, bounds: { width: number; height: number }) => void;
  tile: (bounds: { width: number; height: number }) => void;
}

const MIN_WIDTH = 280;
const MIN_HEIGHT = 180;
const TILE_GAP = 12;

export const useWindowStore = create<WindowManagerState>((set, get) => ({
  windows: {},
  topZIndex: 1,

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
          maximized: false,
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

  tile: (bounds) => {
    const entries = Object.entries(get().windows).filter(([, w]) => !w.closed && !w.minimized);
    if (entries.length === 0) return;

    const cols = Math.ceil(Math.sqrt(entries.length));
    const rows = Math.ceil(entries.length / cols);
    const cellWidth = Math.max(MIN_WIDTH, (bounds.width - TILE_GAP * (cols + 1)) / cols);
    const cellHeight = Math.max(MIN_HEIGHT, (bounds.height - TILE_GAP * (rows + 1)) / rows);

    set((state) => {
      const windows = { ...state.windows };
      entries.forEach(([id], i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
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
