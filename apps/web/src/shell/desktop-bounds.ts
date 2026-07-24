import { useZoomStore } from "./zoom-store";

/** .desktop's size in its own local (zoomed) coordinate space — the space
 * window x/y/width/height are stored and rendered in, since .desktop
 * carries the zoom (zoom-store.ts), not <html>. getBoundingClientRect()
 * always reports real screen px regardless of an element's own zoom, so
 * real-to-local conversion (divide by zoom) is needed for anything that
 * computes literal window geometry from .desktop's box — tile(), maximize.
 */
export function desktopBounds(): { width: number; height: number } {
  const el = document.querySelector(".desktop");
  const rect = el?.getBoundingClientRect();
  const zoom = useZoomStore.getState().zoom;
  const realWidth = rect?.width ?? window.innerWidth;
  const realHeight = rect?.height ?? window.innerHeight;
  return { width: realWidth / zoom, height: realHeight / zoom };
}
