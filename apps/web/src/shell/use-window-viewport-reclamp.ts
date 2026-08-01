import { useEffect } from "react";
import { useWindowStore } from "./window-store";

const RECLAMP_DEBOUNCE_MS = 150;
// Long enough for the persisted layout to have been restored, short enough
// that an oversized window isn't visible for meaningfully long.
const INITIAL_RECLAMP_MS = 400;

/** Keeps every open window in bounds as the browser viewport itself is
 * resized — without this, shrinking the window could leave a
 * previously-fully-visible window stranded past the new, smaller edge
 * until the user happens to drag it. Debounced since "resize" fires on
 * every intermediate frame while the user is actively dragging the browser
 * edge, not just once at the end. */
export function useWindowViewportReclamp(): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    // Also run once shortly after mount, not only on resize: a layout saved
    // on a desktop and restored on a phone never fires a resize event, so
    // those windows stayed oversized until the user happened to rotate or
    // resize something. The delay lets persistence finish restoring first —
    // reclamping an empty store would do nothing.
    const initial = setTimeout(() => useWindowStore.getState().reclampAll(), INITIAL_RECLAMP_MS);

    function onResize() {
      clearTimeout(timer);
      timer = setTimeout(() => useWindowStore.getState().reclampAll(), RECLAMP_DEBOUNCE_MS);
    }
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      clearTimeout(timer);
      clearTimeout(initial);
    };
  }, []);
}
