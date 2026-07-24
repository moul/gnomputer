import { describe, it, expect } from "vitest";
import { rankByActivity } from "./rank-by-activity";

describe("rankByActivity", () => {
  it("tallies event counts per pkgPath, most active first", () => {
    const events = [
      { pkgPath: "gno.land/r/gnoland/blog" },
      { pkgPath: "gno.land/r/gov/dao" },
      { pkgPath: "gno.land/r/gnoland/blog" },
      { pkgPath: "gno.land/r/gnoland/blog" },
      { pkgPath: "gno.land/r/gov/dao" },
    ];
    expect(rankByActivity(events)).toEqual([
      { packagePath: "gno.land/r/gnoland/blog", eventCount: 3 },
      { packagePath: "gno.land/r/gov/dao", eventCount: 2 },
    ]);
  });

  it("ignores events with no pkgPath", () => {
    const events = [{ pkgPath: null }, { pkgPath: "gno.land/r/gov/dao" }, { pkgPath: null }];
    expect(rankByActivity(events)).toEqual([{ packagePath: "gno.land/r/gov/dao", eventCount: 1 }]);
  });

  it("returns an empty list for no events", () => {
    expect(rankByActivity([])).toEqual([]);
  });
});
