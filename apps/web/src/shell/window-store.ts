import { create } from "zustand";

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
}

interface WindowManagerState {
  windows: Record<string, WindowRecord>;
  topZIndex: number;
  ensureWindow: (id: string, title: string, defaults: WindowGeometry) => void;
  focus: (id: string) => void;
  move: (id: string, x: number, y: number) => void;
  resize: (id: string, width: number, height: number) => void;
  close: (id: string) => void;
  reopen: (id: string) => void;
}

const MIN_WIDTH = 280;
const MIN_HEIGHT = 180;

export const useWindowStore = create<WindowManagerState>((set, get) => ({
  windows: {},
  topZIndex: 1,

  ensureWindow: (id, title, defaults) => {
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
        [id]: { ...defaults, title, zIndex: nextZ, closed: false },
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
    if (!win) return;
    set((state) => ({
      windows: { ...state.windows, [id]: { ...win, x: Math.max(0, x), y: Math.max(0, y) } },
    }));
  },

  resize: (id, width, height) => {
    const win = get().windows[id];
    if (!win) return;
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
      windows: { ...state.windows, [id]: { ...state.windows[id]!, closed: false } },
    }));
  },
}));
