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
  // `zoom` is a non-standard CSS property (no CSSStyleDeclaration typing),
  // widely supported by Chromium/Safari/Firefox, and unlike `transform:
  // scale()` it rescales layout itself — pointer coordinates used by window
  // drag/resize (window.tsx) stay correct with no extra coordinate math.
  document.documentElement.style.setProperty("zoom", String(zoom));
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
