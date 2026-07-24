import { useEffect } from "react";
import { openSettings } from "./open-settings";

/** Shortcuts that don't belong to one specific piece of chrome (command
 * palette owns its own Cmd+K, shortcuts-help owns its own Cmd+/, ...) —
 * mounted once at the app root. Deliberately narrow: browsers reserve a lot
 * of Cmd/Ctrl+<key> combinations for their own zoom/tab/window handling
 * (Cmd+Plus/Minus/0, Cmd+W, ...) in ways a page can't reliably override, so
 * only combinations confirmed safe across browsers belong here. */
export function useGlobalShortcuts() {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        openSettings("network");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
