import { create } from "zustand";
import { isMobileViewport } from "./viewport";

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 1.5;
export const ZOOM_STEP = 0.1;

// Mobile used to default to 0.75 to fit more of a desktop-sized canvas on
// screen — a workaround for having no real narrow-screen layout. Now that
// panes stack and controls are sized for touch (shell.css's width media
// queries), that zoom actively hurts: it shrank every 44px touch target to
// 33px and made text harder to read, to show more of a layout that no
// longer needs showing. 1 means a tapped target is the size it claims.
const DEFAULT_MOBILE_ZOOM = 1;

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
