import { useWindowStore } from "./window-store";
import { useRealmTabsStore } from "./realm-tabs-store";
import { realmFamilyIds } from "./focus-family";
import { smartTruncateRealmPath } from "./smart-truncate-realm-path";

function scrollToWindow(id: string) {
  document.getElementById(`window-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
}

/** Lists every currently-open Browser window — the Browser icon supports
 * multiple windows at once (pop out a tab), so a single click only ever
 * reaches whichever one was focused most recently; hovering shows the full
 * set instead of hiding the others. Each row shows the realm path it's
 * showing (smart-truncated, no "Browser" prefix repeated — the menu's own
 * title already says "Browser", and the window's OWN titlebar is where
 * that prefix belongs), or "Home" for one still on the tab-picker screen. */
export function IslandBrowserMenu() {
  const windows = useWindowStore((s) => s.windows);
  const realmTabWindows = useRealmTabsStore((s) => s.windows);
  const focus = useWindowStore((s) => s.focus);
  const createNewWindow = useRealmTabsStore((s) => s.createNewWindow);

  const openIds = realmFamilyIds(windows).filter((id) => windows[id] && !windows[id]!.closed);

  function labelForWindow(id: string): string {
    const tabsWindow = realmTabWindows[id];
    const activeTab = tabsWindow?.tabs.find((t) => t.id === tabsWindow.activeTabId);
    const packagePath = activeTab?.packagePath ?? "";
    return packagePath === "" ? "Home" : smartTruncateRealmPath(packagePath);
  }

  return (
    <div className="island-menu">
      <p className="island-menu__title">Browser</p>
      <ul className="island-menu__list">
        {openIds.map((id) => (
          <li key={id}>
            <button
              type="button"
              onClick={() => {
                focus(id);
                scrollToWindow(id);
              }}
            >
              <span aria-hidden="true">🌐</span>
              <span className="island-menu__list-label">{labelForWindow(id)}</span>
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="island-menu__action"
        onClick={() => {
          const newId = createNewWindow();
          requestAnimationFrame(() => scrollToWindow(newId));
        }}
      >
        + New window
      </button>
    </div>
  );
}
