import { useEffect } from "react";
import { useWindowStore } from "./window-store";

const RECLAMP_DEBOUNCE_MS = 150;

/** Keeps every open window in bounds as the browser viewport itself is
 * resized — without this, shrinking the window could leave a
 * previously-fully-visible window stranded past the new, smaller edge
 * until the user happens to drag it. Debounced since "resize" fires on
 * every intermediate frame while the user is actively dragging the browser
 * edge, not just once at the end. */
export function useWindowViewportReclamp(): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    function onResize() {
      clearTimeout(timer);
      timer = setTimeout(() => useWindowStore.getState().reclampAll(), RECLAMP_DEBOUNCE_MS);
    }
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      clearTimeout(timer);
    };
  }, []);
}
