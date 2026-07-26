import { describe, it, expect, afterEach } from "vitest";
import { desktopBounds, clientToDesktopLocal } from "./desktop-bounds";
import { useZoomStore } from "./zoom-store";

function mountDesktop(rect: Partial<DOMRect>, scrollLeft = 0, scrollTop = 0): HTMLElement {
  const el = document.createElement("div");
  el.className = "desktop";
  el.scrollLeft = scrollLeft;
  el.scrollTop = scrollTop;
  el.getBoundingClientRect = () => rect as DOMRect;
  document.body.appendChild(el);
  return el;
}

describe("desktopBounds / clientToDesktopLocal", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    useZoomStore.getState().setZoom(1);
  });

  it("returns .desktop's real size divided by the current zoom", () => {
    mountDesktop({ width: 1000, height: 800, left: 0, top: 0 } as DOMRect);
    useZoomStore.getState().setZoom(0.5);

    expect(desktopBounds()).toEqual({ width: 2000, height: 1600 });
  });

  it("falls back to window.innerWidth/innerHeight when .desktop isn't mounted", () => {
    expect(desktopBounds()).toEqual({ width: window.innerWidth, height: window.innerHeight });
  });

  it("converts a real screen point into .desktop's zoomed+scrolled local space", () => {
    mountDesktop({ width: 1000, height: 800, left: 50, top: 20 } as DOMRect, 30, 10);
    useZoomStore.getState().setZoom(0.5);

    // A click at (150, 120): subtract .desktop's own offset (50, 20) -> (100,
    // 100), divide by zoom (0.5) -> (200, 200), then add scroll (30, 10).
    expect(clientToDesktopLocal(150, 120)).toEqual({ x: 230, y: 210 });
  });

  it("treats a missing .desktop as offset (0,0) with no scroll", () => {
    expect(clientToDesktopLocal(150, 120)).toEqual({ x: 150, y: 120 });
  });
});
