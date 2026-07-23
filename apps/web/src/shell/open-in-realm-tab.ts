import { router } from "../routes/root";
import { useRealmTabsStore, type RealmLens } from "./realm-tabs-store";

/** Navigates the given realm-browser window's active tab to a target realm
 * (or back to its home state, if packagePath is ""). Only the primary
 * "realm" window's URL is kept in sync — standalone pop-out windows are
 * client-state only, since there's just one browser URL to share. */
export function openInRealmTab(
  windowId: string,
  target: { packagePath: string; renderPath?: string; lens?: RealmLens }
) {
  const renderPath = target.renderPath ?? "";
  useRealmTabsStore.getState().ensureWindow(windowId);
  useRealmTabsStore.getState().updateActiveTab(windowId, {
    packagePath: target.packagePath,
    renderPath,
    lens: target.lens ?? "render",
  });
  if (windowId === "realm") {
    void router.navigate({
      to: "/",
      search:
        target.packagePath === ""
          ? {}
          : renderPath
            ? { pkg: target.packagePath, path: renderPath }
            : { pkg: target.packagePath },
    });
  }
}
