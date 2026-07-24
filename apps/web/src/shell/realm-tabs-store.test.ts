import { describe, it, expect, beforeEach } from "vitest";
import { useRealmTabsStore } from "./realm-tabs-store";

function resetStore() {
  useRealmTabsStore.setState({ windows: {}, extraWindowIds: [], nextTabSeq: 1, nextWindowSeq: 1 });
}

beforeEach(() => {
  resetStore();
});

describe("ensureWindow", () => {
  it("creates a window with a single Home tab", () => {
    useRealmTabsStore.getState().ensureWindow("realm");
    const win = useRealmTabsStore.getState().windows.realm!;
    expect(win.tabs).toHaveLength(1);
    expect(win.tabs[0]).toMatchObject({ packagePath: "", renderPath: "", lens: "render" });
    expect(win.activeTabId).toBe(win.tabs[0]!.id);
  });

  it("is a no-op for a window id that already exists", () => {
    useRealmTabsStore.getState().ensureWindow("realm");
    const before = useRealmTabsStore.getState().windows.realm;
    useRealmTabsStore.getState().ensureWindow("realm");
    expect(useRealmTabsStore.getState().windows.realm).toBe(before);
  });
});

describe("openTab", () => {
  it("appends a new tab seeded with the given fields and makes it active", () => {
    useRealmTabsStore.getState().ensureWindow("realm");
    useRealmTabsStore.getState().openTab("realm", { packagePath: "gno.land/r/demo/foo" });

    const win = useRealmTabsStore.getState().windows.realm!;
    expect(win.tabs).toHaveLength(2);
    expect(win.tabs[1]!.packagePath).toBe("gno.land/r/demo/foo");
    expect(win.activeTabId).toBe(win.tabs[1]!.id);
  });

  it("is a no-op for a window that doesn't exist", () => {
    useRealmTabsStore.getState().openTab("nope");
    expect(useRealmTabsStore.getState().windows.nope).toBeUndefined();
  });
});

describe("closeTab", () => {
  it("resets to a fresh Home tab when closing the last remaining tab", () => {
    useRealmTabsStore.getState().ensureWindow("realm");
    const homeTabId = useRealmTabsStore.getState().windows.realm!.tabs[0]!.id;

    useRealmTabsStore.getState().closeTab("realm", homeTabId);

    const win = useRealmTabsStore.getState().windows.realm!;
    expect(win.tabs).toHaveLength(1);
    expect(win.tabs[0]!.id).not.toBe(homeTabId);
    expect(win.activeTabId).toBe(win.tabs[0]!.id);
  });

  it("reassigns activeTabId to the tab that slides into the closed one's slot when the active tab is closed", () => {
    useRealmTabsStore.getState().ensureWindow("realm");
    useRealmTabsStore.getState().openTab("realm", { packagePath: "b" });
    useRealmTabsStore.getState().openTab("realm", { packagePath: "c" });
    // Tabs are now [home, b, c], active = c. Make b active, then close it.
    const [, bTab, cTab] = useRealmTabsStore.getState().windows.realm!.tabs;
    useRealmTabsStore.getState().setActiveTab("realm", bTab!.id);

    useRealmTabsStore.getState().closeTab("realm", bTab!.id);

    const win = useRealmTabsStore.getState().windows.realm!;
    expect(win.tabs.map((t) => t.packagePath)).toEqual(["", "c"]);
    // b was at index 1; after removal, index 1 is now c — c becomes active.
    expect(win.activeTabId).toBe(cTab!.id);
  });

  it("leaves activeTabId untouched when closing a tab that isn't the active one", () => {
    useRealmTabsStore.getState().ensureWindow("realm");
    useRealmTabsStore.getState().openTab("realm", { packagePath: "b" });
    const win0 = useRealmTabsStore.getState().windows.realm!;
    const homeTabId = win0.tabs[0]!.id;
    const activeId = win0.activeTabId;

    useRealmTabsStore.getState().closeTab("realm", homeTabId);

    const win = useRealmTabsStore.getState().windows.realm!;
    expect(win.activeTabId).toBe(activeId);
    expect(win.tabs.find((t) => t.id === homeTabId)).toBeUndefined();
  });

  it("is a no-op for an unknown window or tab id", () => {
    useRealmTabsStore.getState().ensureWindow("realm");
    expect(() => useRealmTabsStore.getState().closeTab("realm", "no-such-tab")).not.toThrow();
    expect(useRealmTabsStore.getState().windows.realm!.tabs).toHaveLength(1);
    expect(() => useRealmTabsStore.getState().closeTab("no-such-window", "tab-1")).not.toThrow();
  });
});

describe("setActiveTab and updateActiveTab", () => {
  it("setActiveTab only accepts a tab id that belongs to the window", () => {
    useRealmTabsStore.getState().ensureWindow("realm");
    useRealmTabsStore.getState().openTab("realm", { packagePath: "b" });
    const homeTabId = useRealmTabsStore.getState().windows.realm!.tabs[0]!.id;

    useRealmTabsStore.getState().setActiveTab("realm", homeTabId);
    expect(useRealmTabsStore.getState().windows.realm!.activeTabId).toBe(homeTabId);

    useRealmTabsStore.getState().setActiveTab("realm", "bogus-id");
    expect(useRealmTabsStore.getState().windows.realm!.activeTabId).toBe(homeTabId);
  });

  it("updateActiveTab patches only the currently-active tab", () => {
    useRealmTabsStore.getState().ensureWindow("realm");
    useRealmTabsStore.getState().openTab("realm", { packagePath: "b" });
    const homeTabId = useRealmTabsStore.getState().windows.realm!.tabs[0]!.id;

    useRealmTabsStore.getState().updateActiveTab("realm", { renderPath: "sub/path" });

    const win = useRealmTabsStore.getState().windows.realm!;
    const active = win.tabs.find((t) => t.id === win.activeTabId)!;
    const home = win.tabs.find((t) => t.id === homeTabId)!;
    expect(active.renderPath).toBe("sub/path");
    expect(home.renderPath).toBe("");
  });
});

describe("popOutActiveTab", () => {
  it("moves the active tab into a brand-new extra window, leaving the source window intact", () => {
    useRealmTabsStore.getState().ensureWindow("realm");
    useRealmTabsStore.getState().openTab("realm", { packagePath: "gno.land/r/demo/foo" });

    const newWindowId = useRealmTabsStore.getState().popOutActiveTab("realm");

    expect(newWindowId).not.toBeNull();
    expect(useRealmTabsStore.getState().extraWindowIds).toContain(newWindowId);

    const newWin = useRealmTabsStore.getState().windows[newWindowId!]!;
    expect(newWin.tabs).toHaveLength(1);
    expect(newWin.tabs[0]!.packagePath).toBe("gno.land/r/demo/foo");

    const sourceWin = useRealmTabsStore.getState().windows.realm!;
    expect(sourceWin.tabs).toHaveLength(1);
    expect(sourceWin.tabs[0]!.packagePath).toBe("");
  });

  it("leaves a fresh Home tab behind when popping out the only tab in a window", () => {
    useRealmTabsStore.getState().ensureWindow("realm");

    useRealmTabsStore.getState().popOutActiveTab("realm");

    const sourceWin = useRealmTabsStore.getState().windows.realm!;
    expect(sourceWin.tabs).toHaveLength(1);
    expect(sourceWin.tabs[0]!.packagePath).toBe("");
  });

  it("returns null for a window that doesn't exist", () => {
    expect(useRealmTabsStore.getState().popOutActiveTab("nope")).toBeNull();
  });
});

describe("createNewWindow and removeWindow", () => {
  it("createNewWindow creates a distinct extra window with its own Home tab each time", () => {
    const id1 = useRealmTabsStore.getState().createNewWindow();
    const id2 = useRealmTabsStore.getState().createNewWindow();

    expect(id1).not.toBe(id2);
    expect(useRealmTabsStore.getState().extraWindowIds).toEqual([id1, id2]);
    expect(useRealmTabsStore.getState().windows[id1]!.tabs).toHaveLength(1);
    expect(useRealmTabsStore.getState().windows[id2]!.tabs).toHaveLength(1);
  });

  it("removeWindow deletes the window record and drops it from extraWindowIds", () => {
    const id = useRealmTabsStore.getState().createNewWindow();
    useRealmTabsStore.getState().removeWindow(id);

    expect(useRealmTabsStore.getState().windows[id]).toBeUndefined();
    expect(useRealmTabsStore.getState().extraWindowIds).not.toContain(id);
  });
});
