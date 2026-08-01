import { describe, it, expect, beforeEach, vi } from "vitest";
import { useWindowStore } from "./window-store";

// desktopBounds reads the live DOM; stub a phone-sized desktop.
vi.mock("./desktop-bounds", () => ({
  desktopBounds: () => ({ width: 375, height: 667 }),
  clientToDesktopLocal: (x: number, y: number) => ({ x, y }),
}));

describe("reclampAll on a smaller viewport", () => {
  beforeEach(() => {
    useWindowStore.setState({ windows: {}, topZIndex: 1 });
  });

  it("shrinks a window restored from a desktop layout to fit the screen", () => {
    // The AUD-008 case: a layout saved at 1440px, reopened on a phone.
    useWindowStore.setState({
      windows: {
        realm: {
          id: "realm", title: "Browser", x: 0, y: 0, width: 960, height: 700,
          zIndex: 1, closed: false, maximized: false,
        } as never,
      },
    });

    useWindowStore.getState().reclampAll();

    const w = useWindowStore.getState().windows.realm!;
    expect(w.width).toBeLessThanOrEqual(375);
    expect(w.height).toBeLessThanOrEqual(667);
  });

  it("never grows a window that already fits", () => {
    useWindowStore.setState({
      windows: {
        small: {
          id: "small", title: "Small", x: 10, y: 80, width: 300, height: 240,
          zIndex: 1, closed: false, maximized: false,
        } as never,
      },
    });

    useWindowStore.getState().reclampAll();

    const w = useWindowStore.getState().windows.small!;
    expect(w.width).toBe(300);
    expect(w.height).toBe(240);
  });

  it("leaves maximized and closed windows alone", () => {
    useWindowStore.setState({
      windows: {
        max: { id: "max", title: "M", x: 0, y: 0, width: 9999, height: 9999, zIndex: 1, closed: false, maximized: true } as never,
        shut: { id: "shut", title: "S", x: 0, y: 0, width: 9999, height: 9999, zIndex: 1, closed: true, maximized: false } as never,
      },
    });

    useWindowStore.getState().reclampAll();

    expect(useWindowStore.getState().windows.max!.width).toBe(9999);
    expect(useWindowStore.getState().windows.shut!.width).toBe(9999);
  });
});
