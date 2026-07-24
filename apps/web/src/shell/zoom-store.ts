import { create } from "zustand";
import { isMobileViewport } from "./viewport";

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 1.5;
export const ZOOM_STEP = 0.1;

// A phone-sized viewport shows one window's worth of the desktop at a time
// at 100% zoom — starting zoomed out gives a first-time mobile visitor an
// actual overview instead of a single cropped window.
const DEFAULT_MOBILE_ZOOM = 0.75;

function clampZoom(zoom: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(zoom * 100) / 100));
}

function applyZoom(zoom: number) {
  // Scoped to .desktop, not <html> — status bar and taskbar stay full-size
  // regardless of zoom. `zoom` is a non-standard CSS property (no
  // CSSStyleDeclaration typing), widely supported by Chromium/Safari/
  // Firefox; unlike `transform: scale()` it rescales layout itself, so
  // window position/size (left/top/width/height, all plain px) render
  // correctly rescaled with no math on those values. The one thing that
  // does need adjusting is pointer-move deltas during drag/resize, since
  // .desktop is no longer the root — see window.tsx's use of useZoomStore.
  const desktop = document.querySelector<HTMLElement>(".desktop");
  if (desktop) desktop.style.setProperty("zoom", String(zoom));
}

interface ZoomState {
  zoom: number;
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
}

export const useZoomStore = create<ZoomState>((set, get) => ({
  zoom: isMobileViewport() ? DEFAULT_MOBILE_ZOOM : 1,
  setZoom: (zoom) => {
    const clamped = clampZoom(zoom);
    applyZoom(clamped);
    set({ zoom: clamped });
  },
  zoomIn: () => get().setZoom(get().zoom + ZOOM_STEP),
  zoomOut: () => get().setZoom(get().zoom - ZOOM_STEP),
  resetZoom: () => get().setZoom(1),
}));
