import { useWindowStore } from "./window-store";
import { useRealmTabsStore } from "./realm-tabs-store";
import { realmFamilyIds } from "./focus-family";

function scrollToWindow(id: string) {
  document.getElementById(`window-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
}

/** Lists every currently-open Browser window by title — the Browser icon
 * supports multiple windows at once (pop out a tab), so a single click only
 * ever reaches whichever one was focused most recently; hovering shows the
 * full set instead of hiding the others. */
export function IslandBrowserMenu() {
  const windows = useWindowStore((s) => s.windows);
  const focus = useWindowStore((s) => s.focus);
  const createNewWindow = useRealmTabsStore((s) => s.createNewWindow);

  const openIds = realmFamilyIds(windows).filter((id) => windows[id] && !windows[id]!.closed);

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
              <span className="island-menu__list-label">{windows[id]!.title}</span>
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
