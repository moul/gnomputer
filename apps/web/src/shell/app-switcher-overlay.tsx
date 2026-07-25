import { useAppSwitcherStore } from "./app-switcher-store";
import { useWindowStore } from "./window-store";
import { iconForWindowId } from "./app-registry";

/** Shift+Tab's overlay (use-global-shortcuts.ts drives open/selectedIndex) —
 * a strip of every currently-open window, most-recently-focused first,
 * highlighting whichever one release-Shift will focus. Pure display; all
 * the keyboard state lives in app-switcher-store.ts. */
export function AppSwitcherOverlay() {
  const open = useAppSwitcherStore((s) => s.open);
  const windowIds = useAppSwitcherStore((s) => s.windowIds);
  const selectedIndex = useAppSwitcherStore((s) => s.selectedIndex);
  const windows = useWindowStore((s) => s.windows);

  if (!open) return null;

  return (
    <div className="app-switcher-backdrop">
      <div className="app-switcher" role="listbox" aria-label="Switch window">
        {windowIds.map((id, i) => {
          const win = windows[id];
          if (!win) return null;
          return (
            <div
              key={id}
              className="app-switcher__item"
              data-selected={i === selectedIndex}
              role="option"
              aria-selected={i === selectedIndex}
            >
              <span className="app-switcher__icon" aria-hidden="true">
                {iconForWindowId(id)}
              </span>
              <span className="app-switcher__title">{win.title}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
