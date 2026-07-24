import { describe, it, expect, beforeEach } from "vitest";
import { useWindowStore } from "./window-store";
import { desktopBounds } from "./desktop-bounds";
import { ISLAND_CLEARANCE_PX } from "./viewport";

const DEFAULTS = { x: 10, y: 10, width: 400, height: 300 };

function resetStore() {
  useWindowStore.setState({ windows: {}, topZIndex: 1, overviewOpen: false });
}

beforeEach(() => {
  resetStore();
});

describe("ensureWindow", () => {
  it("creates a window with the given title, defaults size, and an incremented zIndex", () => {
    useWindowStore.getState().ensureWindow("a", "Alpha", DEFAULTS);
    const win = useWindowStore.getState().windows.a!;
    expect(win.title).toBe("Alpha");
    expect(win.width).toBe(DEFAULTS.width);
    expect(win.height).toBe(DEFAULTS.height);
    expect(win.closed).toBe(false);
    expect(win.maximized).toBe(false);
    expect(win.zIndex).toBe(2);
  });

  it("keeps the window's own position within the desktop bounds, not always at defaults.x/y", () => {
    useWindowStore.getState().ensureWindow("a", "Alpha", DEFAULTS);
    const win = useWindowStore.getState().windows.a!;
    const bounds = desktopBounds();
    expect(win.x).toBeGreaterThanOrEqual(0);
    expect(win.x).toBeLessThanOrEqual(Math.max(0, bounds.width - DEFAULTS.width));
    expect(win.y).toBeGreaterThanOrEqual(ISLAND_CLEARANCE_PX);
    expect(win.y).toBeLessThanOrEqual(Math.max(0, bounds.height - DEFAULTS.height));
  });

  it("never places a window's top edge above the island clearance, even when the window is taller than the available desktop height", () => {
    // Regression test: the old clamp let minY collapse to 0 whenever
    // bounds.height - size.height went negative (a window taller than the
    // viewport), tucking the whole titlebar behind the island where it
    // couldn't be dragged or closed.
    const bounds = desktopBounds();
    const tooTall = { x: 0, y: 0, width: 300, height: bounds.height + 500 };
    useWindowStore.getState().ensureWindow("tall", "Tall", tooTall);
    const win = useWindowStore.getState().windows.tall!;
    expect(win.y).toBeGreaterThanOrEqual(ISLAND_CLEARANCE_PX);
  });

  it("respects startClosed and startMaximized options", () => {
    useWindowStore.getState().ensureWindow("a", "Alpha", DEFAULTS, { startClosed: true });
    expect(useWindowStore.getState().windows.a!.closed).toBe(true);

    useWindowStore.getState().ensureWindow("b", "Beta", DEFAULTS, { startMaximized: true });
    const beta = useWindowStore.getState().windows.b!;
    expect(beta.maximized).toBe(true);
    // Maximized windows skip randomized placement entirely — position is
    // exactly the given defaults, not clamped/jittered.
    expect(beta.x).toBe(DEFAULTS.x);
    expect(beta.y).toBe(DEFAULTS.y);
  });

  it("is a no-op for an id that already exists, except updating its title", () => {
    useWindowStore.getState().ensureWindow("a", "Alpha", DEFAULTS);
    const before = useWindowStore.getState().windows.a!;

    useWindowStore.getState().ensureWindow("a", "Alpha Renamed", { x: 999, y: 999, width: 1, height: 1 });
    const after = useWindowStore.getState().windows.a!;

    expect(after.title).toBe("Alpha Renamed");
    expect(after.x).toBe(before.x);
    expect(after.y).toBe(before.y);
    expect(after.width).toBe(before.width);
    expect(after.height).toBe(before.height);
    expect(after.zIndex).toBe(before.zIndex);
  });
});

describe("focus", () => {
  it("bumps the window's zIndex above every other window", () => {
    useWindowStore.getState().ensureWindow("a", "Alpha", DEFAULTS);
    useWindowStore.getState().ensureWindow("b", "Beta", DEFAULTS);
    const bBefore = useWindowStore.getState().windows.b!.zIndex;

    useWindowStore.getState().focus("a");

    const aAfter = useWindowStore.getState().windows.a!;
    expect(aAfter.zIndex).toBeGreaterThan(bBefore);
  });

  it("is a no-op for an id that doesn't exist", () => {
    expect(() => useWindowStore.getState().focus("nope")).not.toThrow();
    expect(useWindowStore.getState().windows.nope).toBeUndefined();
  });
});

describe("move and resize", () => {
  it("moves a non-maximized window and clamps negative coordinates to 0", () => {
    useWindowStore.getState().ensureWindow("a", "Alpha", DEFAULTS);
    useWindowStore.getState().move("a", -50, 123);
    const win = useWindowStore.getState().windows.a!;
    expect(win.x).toBe(0);
    expect(win.y).toBe(123);
  });

  it("does not move a maximized window", () => {
    useWindowStore.getState().ensureWindow("a", "Alpha", DEFAULTS, { startMaximized: true });
    const before = useWindowStore.getState().windows.a!;
    useWindowStore.getState().move("a", 500, 500);
    const after = useWindowStore.getState().windows.a!;
    expect(after.x).toBe(before.x);
    expect(after.y).toBe(before.y);
  });

  it("resizes a window and enforces the minimum width/height", () => {
    useWindowStore.getState().ensureWindow("a", "Alpha", DEFAULTS);
    useWindowStore.getState().resize("a", 10, 10);
    const win = useWindowStore.getState().windows.a!;
    expect(win.width).toBeGreaterThanOrEqual(280);
    expect(win.height).toBeGreaterThanOrEqual(180);
  });

  it("does not resize a maximized window", () => {
    useWindowStore.getState().ensureWindow("a", "Alpha", DEFAULTS, { startMaximized: true });
    const before = useWindowStore.getState().windows.a!;
    useWindowStore.getState().resize("a", 999, 999);
    const after = useWindowStore.getState().windows.a!;
    expect(after.width).toBe(before.width);
    expect(after.height).toBe(before.height);
  });
});

describe("close, closeAll, remove, reopen", () => {
  it("close marks a window closed without deleting its record", () => {
    useWindowStore.getState().ensureWindow("a", "Alpha", DEFAULTS);
    useWindowStore.getState().close("a");
    expect(useWindowStore.getState().windows.a!.closed).toBe(true);
  });

  it("closeAll closes every open window and leaves already-closed ones alone", () => {
    useWindowStore.getState().ensureWindow("a", "Alpha", DEFAULTS);
    useWindowStore.getState().ensureWindow("b", "Beta", DEFAULTS, { startClosed: true });

    useWindowStore.getState().closeAll();

    expect(useWindowStore.getState().windows.a!.closed).toBe(true);
    expect(useWindowStore.getState().windows.b!.closed).toBe(true);
  });

  it("remove deletes the window record entirely", () => {
    useWindowStore.getState().ensureWindow("a", "Alpha", DEFAULTS);
    useWindowStore.getState().remove("a");
    expect(useWindowStore.getState().windows.a).toBeUndefined();
  });

  it("reopen un-closes a window and focuses it", () => {
    useWindowStore.getState().ensureWindow("a", "Alpha", DEFAULTS, { startClosed: true });
    useWindowStore.getState().ensureWindow("b", "Beta", DEFAULTS);
    const bZ = useWindowStore.getState().windows.b!.zIndex;

    useWindowStore.getState().reopen("a");

    const a = useWindowStore.getState().windows.a!;
    expect(a.closed).toBe(false);
    expect(a.zIndex).toBeGreaterThan(bZ);
  });
});

describe("placeNear", () => {
  it("centers the window on the given screen point, clamped to desktop bounds", () => {
    useWindowStore.getState().ensureWindow("a", "Alpha", DEFAULTS);
    useWindowStore.getState().placeNear("a", { x: 500, y: 400 });
    const win = useWindowStore.getState().windows.a!;
    // jsdom has no real .desktop element, so clientToDesktopLocal falls back
    // to treating the client point as already being in local space (rect
    // defaults to {left:0,top:0}, zoom defaults to 1) — the window should be
    // centered on (500, 400), clamped within bounds.
    const bounds = desktopBounds();
    const expectedX = Math.min(Math.max(0, bounds.width - win.width), Math.max(0, 500 - win.width / 2));
    expect(win.x).toBe(Math.round(expectedX));
  });

  it("does not move a maximized window", () => {
    useWindowStore.getState().ensureWindow("a", "Alpha", DEFAULTS, { startMaximized: true });
    const before = useWindowStore.getState().windows.a!;
    useWindowStore.getState().placeNear("a", { x: 0, y: 0 });
    const after = useWindowStore.getState().windows.a!;
    expect(after.x).toBe(before.x);
    expect(after.y).toBe(before.y);
  });
});

describe("toggleMaximize", () => {
  it("maximizes a window, filling the given bounds below the island, and remembers its prior geometry", () => {
    useWindowStore.getState().ensureWindow("a", "Alpha", DEFAULTS);
    const before = useWindowStore.getState().windows.a!;

    useWindowStore.getState().toggleMaximize("a", { width: 1000, height: 800 });

    const maximized = useWindowStore.getState().windows.a!;
    expect(maximized.maximized).toBe(true);
    expect(maximized.x).toBe(0);
    expect(maximized.y).toBe(ISLAND_CLEARANCE_PX);
    expect(maximized.width).toBe(1000);
    expect(maximized.preMaximizeGeometry).toEqual({
      x: before.x,
      y: before.y,
      width: before.width,
      height: before.height,
    });
  });

  it("restores the exact pre-maximize geometry when toggled back", () => {
    useWindowStore.getState().ensureWindow("a", "Alpha", DEFAULTS);
    const before = useWindowStore.getState().windows.a!;

    useWindowStore.getState().toggleMaximize("a", { width: 1000, height: 800 });
    useWindowStore.getState().toggleMaximize("a", { width: 1000, height: 800 });

    const restored = useWindowStore.getState().windows.a!;
    expect(restored.maximized).toBe(false);
    expect(restored.x).toBe(before.x);
    expect(restored.y).toBe(before.y);
    expect(restored.width).toBe(before.width);
    expect(restored.height).toBe(before.height);
    expect(restored.preMaximizeGeometry).toBeNull();
  });
});

describe("toggleOverview and closeOverview", () => {
  it("flips overviewOpen each call once at least 2 windows are open", () => {
    useWindowStore.getState().ensureWindow("a", "Alpha", DEFAULTS);
    useWindowStore.getState().ensureWindow("b", "Beta", DEFAULTS);
    expect(useWindowStore.getState().overviewOpen).toBe(false);
    useWindowStore.getState().toggleOverview();
    expect(useWindowStore.getState().overviewOpen).toBe(true);
    useWindowStore.getState().toggleOverview();
    expect(useWindowStore.getState().overviewOpen).toBe(false);
  });

  it("does not enter overview with fewer than 2 open windows — nothing to expose", () => {
    expect(useWindowStore.getState().overviewOpen).toBe(false);
    useWindowStore.getState().toggleOverview();
    expect(useWindowStore.getState().overviewOpen).toBe(false);

    useWindowStore.getState().ensureWindow("a", "Alpha", DEFAULTS);
    useWindowStore.getState().toggleOverview();
    expect(useWindowStore.getState().overviewOpen).toBe(false);
  });

  it("does not count closed windows toward the 2-window minimum", () => {
    useWindowStore.getState().ensureWindow("a", "Alpha", DEFAULTS);
    useWindowStore.getState().ensureWindow("b", "Beta", DEFAULTS, { startClosed: true });
    useWindowStore.getState().toggleOverview();
    expect(useWindowStore.getState().overviewOpen).toBe(false);
  });

  it("closeOverview always sets overviewOpen to false", () => {
    useWindowStore.setState({ overviewOpen: true });
    useWindowStore.getState().closeOverview();
    expect(useWindowStore.getState().overviewOpen).toBe(false);
  });
});
