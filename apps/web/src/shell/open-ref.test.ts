import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../routes/root", () => ({
  router: { navigate: vi.fn() },
}));

import { router } from "../routes/root";
import { openRef, openEntityMatch, focusOrReopen } from "./open-ref";
import { useWindowStore } from "./window-store";
import { useRealmTabsStore } from "./realm-tabs-store";
import { useAddressWindowStore } from "./address-window-store";
import { usePendingRefsStore } from "./pending-refs-store";
import { useSettingsUiStore } from "./settings-store";

const DEFAULTS = { x: 10, y: 10, width: 400, height: 300 };

beforeEach(() => {
  useWindowStore.setState({ windows: {}, topZIndex: 1, overviewOpen: false });
  useRealmTabsStore.setState({ windows: {}, extraWindowIds: [], nextTabSeq: 1, nextWindowSeq: 1 });
  useAddressWindowStore.setState({ currentAddress: null });
  usePendingRefsStore.setState({ pendingBlockHeight: null });
  useSettingsUiStore.setState({ activeTab: "network" });
  vi.mocked(router.navigate).mockClear();
});

describe("focusOrReopen", () => {
  it("does nothing when the window doesn't exist", () => {
    expect(() => focusOrReopen("nope")).not.toThrow();
  });

  it("reopens a closed window and focuses it", () => {
    useWindowStore.getState().ensureWindow("a", "Alpha", DEFAULTS, { startClosed: true });
    focusOrReopen("a");
    expect(useWindowStore.getState().windows.a!.closed).toBe(false);
  });

  it("just focuses an already-open window", () => {
    useWindowStore.getState().ensureWindow("a", "Alpha", DEFAULTS);
    useWindowStore.getState().ensureWindow("b", "Beta", DEFAULTS);
    const bZ = useWindowStore.getState().windows.b!.zIndex;
    focusOrReopen("a");
    expect(useWindowStore.getState().windows.a!.zIndex).toBeGreaterThan(bZ);
  });

  it("places the window near the given origin", () => {
    useWindowStore.getState().ensureWindow("a", "Alpha", DEFAULTS);
    focusOrReopen("a", { x: 200, y: 150 });
    const win = useWindowStore.getState().windows.a!;
    // Centered on (200, 150): x = 200 - width/2 = 0 (clamped).
    expect(win.x).toBe(0);
  });
});

describe("openRef", () => {
  it("returns false for a URI that doesn't match the known gno:// shapes", () => {
    expect(openRef("https://example.com")).toBe(false);
    expect(openRef("gno://net/unknown-kind/foo")).toBe(false);
  });

  it("realm: opens the realm window's active tab at the given package/render path", () => {
    useWindowStore.getState().ensureWindow("realm", "Browser", DEFAULTS);
    useRealmTabsStore.getState().ensureWindow("realm");

    const handled = openRef("gno://topaz/realm/gno.land/r/demo/foo#sub/path");

    expect(handled).toBe(true);
    const win = useRealmTabsStore.getState().windows.realm!;
    const activeTab = win.tabs.find((t) => t.id === win.activeTabId)!;
    expect(activeTab.packagePath).toBe("gno.land/r/demo/foo");
    expect(activeTab.renderPath).toBe("sub/path");
    expect(activeTab.lens).toBe("render");
  });

  it("source-file: opens the realm window's active tab in the source lens", () => {
    useWindowStore.getState().ensureWindow("realm", "Browser", DEFAULTS);
    useRealmTabsStore.getState().ensureWindow("realm");

    openRef("gno://topaz/source-file/gno.land/r/demo/foo");

    const win = useRealmTabsStore.getState().windows.realm!;
    const activeTab = win.tabs.find((t) => t.id === win.activeTabId)!;
    expect(activeTab.packagePath).toBe("gno.land/r/demo/foo");
    expect(activeTab.lens).toBe("source");
  });

  it("address: sets the current address and reopens the Accounts window", () => {
    useWindowStore.getState().ensureWindow("address", "Accounts", DEFAULTS, { startClosed: true });

    const handled = openRef("gno://topaz/address/g1abc");

    expect(handled).toBe(true);
    expect(useAddressWindowStore.getState().currentAddress).toBe("g1abc");
    expect(useWindowStore.getState().windows.address!.closed).toBe(false);
  });

  it("block: sets the pending block height and reopens the block explorer, rejecting a non-numeric height", () => {
    useWindowStore.getState().ensureWindow("block-explorer", "Block Explorer", DEFAULTS, {
      startClosed: true,
    });

    expect(openRef("gno://topaz/block/12345")).toBe(true);
    expect(usePendingRefsStore.getState().pendingBlockHeight).toBe(12345);
    expect(useWindowStore.getState().windows["block-explorer"]!.closed).toBe(false);

    expect(openRef("gno://topaz/block/not-a-number")).toBe(false);
  });

  it("settings: switches the settings tab for a valid tab name, rejects an unknown one", () => {
    useWindowStore.getState().ensureWindow("settings", "Settings", DEFAULTS, { startClosed: true });

    expect(openRef("gno://topaz/settings/theme")).toBe(true);
    expect(useSettingsUiStore.getState().activeTab).toBe("theme");
    expect(useWindowStore.getState().windows.settings!.closed).toBe(false);

    expect(openRef("gno://topaz/settings/not-a-real-tab")).toBe(false);
  });
});

describe("openEntityMatch", () => {
  it("address: routes through openRef with a gno://_/address/ URI", () => {
    useWindowStore.getState().ensureWindow("address", "Accounts", DEFAULTS, { startClosed: true });
    openEntityMatch("address", "g1xyz");
    expect(useAddressWindowStore.getState().currentAddress).toBe("g1xyz");
  });

  it("block: strips a leading # before routing to openRef", () => {
    useWindowStore.getState().ensureWindow("block-explorer", "Block Explorer", DEFAULTS, {
      startClosed: true,
    });
    openEntityMatch("block", "#4242");
    expect(usePendingRefsStore.getState().pendingBlockHeight).toBe(4242);
  });

  it("realm: expands a bare r/... path to gno.land/r/..., leaves a full path untouched", () => {
    useWindowStore.getState().ensureWindow("realm", "Browser", DEFAULTS);
    useRealmTabsStore.getState().ensureWindow("realm");

    openEntityMatch("realm", "r/demo/foo");
    let win = useRealmTabsStore.getState().windows.realm!;
    expect(win.tabs.find((t) => t.id === win.activeTabId)!.packagePath).toBe("gno.land/r/demo/foo");

    openEntityMatch("realm", "other.land/r/demo/bar");
    win = useRealmTabsStore.getState().windows.realm!;
    expect(win.tabs.find((t) => t.id === win.activeTabId)!.packagePath).toBe("other.land/r/demo/bar");
  });

  it("username: navigates to the users realm instead of guessing a per-user page", () => {
    openEntityMatch("username", "@moul");
    expect(router.navigate).toHaveBeenCalledWith({
      to: "/",
      search: { pkg: "gno.land/r/sys/users" },
    });
  });
});
