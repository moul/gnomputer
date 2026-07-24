import { describe, it, expect } from "vitest";
import { computeOverviewLayout } from "./overview-layout";

describe("computeOverviewLayout", () => {
  it("returns nothing for no entries", () => {
    expect(computeOverviewLayout([], { width: 1000, height: 800 })).toEqual({});
  });

  it("centers a single window within the usable area", () => {
    const layout = computeOverviewLayout([{ id: "a", width: 400, height: 300 }], {
      width: 1000,
      height: 800,
    });
    const rect = layout["a"]!;
    // Never upscaled past its real size, since it already fits the single cell.
    expect(rect.width).toBe(400);
    expect(rect.height).toBe(300);
    expect(rect.x).toBeGreaterThan(0);
    expect(rect.y).toBeGreaterThan(0);
  });

  it("never upscales a window beyond its real size even with lots of room", () => {
    const layout = computeOverviewLayout([{ id: "a", width: 100, height: 80 }], {
      width: 2000,
      height: 2000,
    });
    expect(layout["a"]!.width).toBe(100);
    expect(layout["a"]!.height).toBe(80);
  });

  it("shrinks a window to fit its cell while preserving aspect ratio", () => {
    const layout = computeOverviewLayout(
      [
        { id: "a", width: 800, height: 600 },
        { id: "b", width: 800, height: 600 },
      ],
      { width: 900, height: 800 }
    );
    for (const id of ["a", "b"]) {
      const rect = layout[id]!;
      expect(rect.width).toBeLessThan(800);
      expect(rect.height).toBeLessThan(600);
      // Aspect ratio preserved (4:3).
      expect(rect.width / rect.height).toBeCloseTo(800 / 600, 5);
    }
  });

  it("places windows in distinct, non-overlapping cells", () => {
    const layout = computeOverviewLayout(
      [
        { id: "a", width: 300, height: 200 },
        { id: "b", width: 300, height: 200 },
        { id: "c", width: 300, height: 200 },
        { id: "d", width: 300, height: 200 },
      ],
      { width: 1200, height: 900 }
    );
    const rects = Object.values(layout);
    expect(rects).toHaveLength(4);
    const ids = new Set(Object.keys(layout));
    expect(ids.size).toBe(4);
    // No two cells share the same top-left origin.
    const origins = new Set(rects.map((r) => `${Math.round(r.x)},${Math.round(r.y)}`));
    expect(origins.size).toBe(4);
  });
});
