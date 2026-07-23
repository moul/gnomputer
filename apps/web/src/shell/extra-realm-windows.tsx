import { useRealmTabsStore } from "./realm-tabs-store";
import { useWindowStore } from "./window-store";
import { Window } from "./window";
import { RealmBrowser } from "../routes/realm-browser";

/** Renders one Window per popped-out realm-browser instance (task: "realm
 * browser should allow having several tabs and even several windows"). The
 * primary "realm" window is mounted directly in Home; these are the extra
 * ones created via the tab strip's pop-out button. */
export function ExtraRealmWindows() {
  const extraWindowIds = useRealmTabsStore((s) => s.extraWindowIds);
  const removeRealmWindow = useRealmTabsStore((s) => s.removeWindow);
  const removeWindowRecord = useWindowStore((s) => s.remove);
  const windows = useRealmTabsStore((s) => s.windows);

  return (
    <>
      {extraWindowIds.map((id, i) => {
        const win = windows[id];
        const activeTab = win?.tabs.find((t) => t.id === win.activeTabId);
        const title = activeTab && activeTab.packagePath !== "" ? `Realm Browser · ${activeTab.packagePath}` : "Realm Browser";
        return (
          <Window
            key={id}
            id={id}
            title={title}
            accent="cyan"
            defaultGeometry={{ x: 40 + i * 24, y: 40 + i * 24, width: 460, height: 340 }}
            onClose={() => {
              removeRealmWindow(id);
              removeWindowRecord(id);
            }}
          >
            <RealmBrowser windowId={id} />
          </Window>
        );
      })}
    </>
  );
}
