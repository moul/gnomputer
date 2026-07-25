import { useEffect } from "react";
import { openSettings } from "./open-settings";
import { useAppSwitcherStore } from "./app-switcher-store";
import { useWindowStore } from "./window-store";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
}

function openWindowIdsByRecency(): string[] {
  return Object.entries(useWindowStore.getState().windows)
    .filter(([, w]) => !w.closed)
    .sort((a, b) => b[1].zIndex - a[1].zIndex)
    .map(([id]) => id);
}

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
        return;
      }
      // Shift+Tab as an app switcher (hold Shift, tap Tab to cycle, release
      // Shift to commit) — skipped inside text fields, where Shift+Tab's
      // normal "move focus backward" behavior is the one people actually
      // want (and the one assistive tech expects).
      if (e.shiftKey && e.key === "Tab" && !isEditableTarget(e.target)) {
        e.preventDefault();
        const switcher = useAppSwitcherStore.getState();
        if (switcher.open) {
          switcher.advance();
        } else {
          switcher.begin(openWindowIdsByRecency());
        }
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.key !== "Shift") return;
      const switcher = useAppSwitcherStore.getState();
      if (!switcher.open) return;
      const selectedId = switcher.windowIds[switcher.selectedIndex];
      switcher.cancel();
      if (selectedId) useWindowStore.getState().focus(selectedId);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);
}
