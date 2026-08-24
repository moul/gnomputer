import { router } from "../routes/root";
import { useRealmTabsStore, type RealmLens } from "./realm-tabs-store";

/**
 * Points the URL at the active tab — the opposite direction to everything
 * else here, for when the tabs changed underneath the URL rather than because
 * of it. Switching networks is the case: the address bar is still naming a
 * realm on the chain just left.
 *
 * Only the primary window has a URL to speak for it; other windows are
 * client-state only.
 * @param {string} windowId the realm-browser window to read the active tab from
 */
export function syncUrlToActiveTab(windowId: string): void {
  if (windowId !== "realm") return;
  const win = useRealmTabsStore.getState().windows[windowId];
  const tab = win?.tabs.find((t) => t.id === win.activeTabId);
  if (!tab) return;
  void router.navigate({
    to: "/",
    search: (previous: Record<string, unknown>) => {
      const net = typeof previous.net === "string" ? { net: previous.net } : {};
      if (tab.packagePath === "") return net;
      return {
        ...net,
        pkg: tab.packagePath,
        ...(tab.renderPath ? { path: tab.renderPath } : {}),
        ...(tab.lens === "render" ? {} : { lens: tab.lens }),
      };
    },
  });
}

/**
 * Points the active tab at what the URL names, unless it is already there.
 *
 * The no-op check matters: this runs both when the URL changes and again once
 * persisted tabs finish restoring, and `openInRealmTab` navigates the router,
 * so re-applying an already-current URL unconditionally would loop.
 * @param {string} windowId the realm-browser window to sync
 * @param {string} packagePath the package path the URL names
 * @param {string} [renderPath] the render path the URL names, if any
 * @param {RealmLens} [lens] the lens the URL names, if any
 */
export function applyUrlToActiveTab(
  windowId: string,
  packagePath: string,
  renderPath?: string,
  lens?: RealmLens
) {
  const current = useRealmTabsStore.getState().windows[windowId];
  const activeTab = current?.tabs.find((t) => t.id === current.activeTabId);
  if (!activeTab) return;
  if (
    activeTab.packagePath === packagePath &&
    activeTab.renderPath === (renderPath ?? "") &&
    (lens === undefined || activeTab.lens === lens)
  ) {
    return;
  }
  openInRealmTab(windowId, { packagePath, renderPath, lens });
}

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
      // lens=render is omitted rather than written out: it is the default,
      // so a link with no lens must keep meaning "the default lens" and
      // every link shared before this stays valid.
      //
      // net is carried through rather than rebuilt. This object replaces the
      // whole search string, so anything not named here is dropped — and
      // dropping net meant opening a shared ?net=betanet link and clicking
      // once left a URL that sends the next person to their own default
      // network instead.
      search: (previous: Record<string, unknown>) => {
        const net = typeof previous.net === "string" ? { net: previous.net } : {};
        if (target.packagePath === "") return net;
        return {
          ...net,
          pkg: target.packagePath,
          ...(renderPath ? { path: renderPath } : {}),
          ...(!target.lens || target.lens === "render" ? {} : { lens: target.lens }),
        };
      },
    });
  }
}
