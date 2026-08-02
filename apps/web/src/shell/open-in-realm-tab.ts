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
