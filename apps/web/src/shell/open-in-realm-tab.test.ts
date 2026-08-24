import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../routes/root", () => ({
  router: { navigate: vi.fn() },
}));

import { router } from "../routes/root";
import { applyUrlToActiveTab, syncUrlToActiveTab } from "./open-in-realm-tab";
import { useRealmTabsStore, type RealmLens } from "./realm-tabs-store";

/** The search object the router was last asked to navigate to. It is written
 * as a function of the previous search, so it has to be invoked to be read. */
function lastSearch(previous: Record<string, unknown> = {}): Record<string, unknown> {
  const calls = vi.mocked(router.navigate).mock.calls;
  const arg = calls[calls.length - 1]![0] as { search: (p: Record<string, unknown>) => unknown };
  return arg.search(previous) as Record<string, unknown>;
}

function openTabAt(packagePath: string, renderPath = "", lens: RealmLens = "render") {
  useRealmTabsStore.getState().ensureWindow("realm");
  useRealmTabsStore.getState().updateActiveTab("realm", { packagePath, renderPath, lens });
}

beforeEach(() => {
  vi.mocked(router.navigate).mockClear();
  useRealmTabsStore.setState({
    windows: {},
    extraWindowIds: [],
    nextTabSeq: 1,
    nextWindowSeq: 1,
    urlSeeded: {},
  });
});

describe("syncUrlToActiveTab", () => {
  it("puts the active tab's realm in the URL", () => {
    // Used when the tabs changed underneath the URL rather than because of it
    // — switching network, where the address bar still names a realm on the
    // chain just left.
    openTabAt("gno.land/r/x");
    syncUrlToActiveTab("realm");

    expect(lastSearch()).toEqual({ pkg: "gno.land/r/x" });
  });

  it("carries the render path and a non-default lens", () => {
    openTabAt("gno.land/r/x", "hello", "source");
    syncUrlToActiveTab("realm");

    expect(lastSearch()).toEqual({ pkg: "gno.land/r/x", path: "hello", lens: "source" });
  });

  it("omits the default lens, so links made before it existed keep working", () => {
    openTabAt("gno.land/r/x", "", "render");
    syncUrlToActiveTab("realm");

    expect(lastSearch()).not.toHaveProperty("lens");
  });

  it("clears the realm when the active tab is Home", () => {
    useRealmTabsStore.getState().ensureWindow("realm");
    syncUrlToActiveTab("realm");

    expect(lastSearch()).toEqual({});
  });

  it("carries the network through, since the search object replaces the whole query", () => {
    openTabAt("gno.land/r/x");
    syncUrlToActiveTab("realm");

    expect(lastSearch({ net: "betanet" })).toMatchObject({ net: "betanet" });
  });

  it("ignores windows other than the primary one, which have no URL", () => {
    useRealmTabsStore.getState().ensureWindow("realm-2");
    syncUrlToActiveTab("realm-2");

    expect(router.navigate).not.toHaveBeenCalled();
  });

  it("does nothing when the window has no tabs to read", () => {
    syncUrlToActiveTab("realm");

    expect(router.navigate).not.toHaveBeenCalled();
  });
});

describe("applyUrlToActiveTab", () => {
  it("points the active tab at what the URL names", () => {
    openTabAt("gno.land/r/old");
    applyUrlToActiveTab("realm", "gno.land/r/new");

    expect(useRealmTabsStore.getState().windows.realm!.tabs[0]!.packagePath).toBe("gno.land/r/new");
  });

  it("is a no-op when the tab is already there", () => {
    // This runs both on URL changes and again once restoration settles, and it
    // navigates the router — so re-applying an already-current URL would loop.
    openTabAt("gno.land/r/x");
    vi.mocked(router.navigate).mockClear();

    applyUrlToActiveTab("realm", "gno.land/r/x");

    expect(router.navigate).not.toHaveBeenCalled();
  });

  it("treats a differing lens as worth applying", () => {
    openTabAt("gno.land/r/x", "", "render");
    applyUrlToActiveTab("realm", "gno.land/r/x", "", "source");

    expect(useRealmTabsStore.getState().windows.realm!.tabs[0]!.lens).toBe("source");
  });

  it("leaves the lens alone when the URL does not name one", () => {
    openTabAt("gno.land/r/x", "", "source");
    vi.mocked(router.navigate).mockClear();

    applyUrlToActiveTab("realm", "gno.land/r/x", "", undefined);

    expect(router.navigate).not.toHaveBeenCalled();
  });

  it("does nothing when there is no active tab yet", () => {
    applyUrlToActiveTab("realm", "gno.land/r/x");

    expect(router.navigate).not.toHaveBeenCalled();
  });
});
