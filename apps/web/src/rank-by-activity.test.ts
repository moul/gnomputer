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

  it("sums a realm that appears in both the indexer backfill and the live feed", () => {
    // The home screen's "Recently active" ranks two sources at once: the
    // indexer's recent history (so the panel is populated on arrival rather
    // than blank) and whatever has streamed in since the window opened. A
    // realm active in both must rank by its combined count, not appear twice
    // or count only once.
    const backfill = [{ pkgPath: "gno.land/r/gov/dao" }, { pkgPath: "gno.land/r/gov/dao" }];
    const live = [{ pkgPath: "gno.land/r/gov/dao" }, { pkgPath: "gno.land/r/gnoland/blog" }];

    expect(rankByActivity([...live, ...backfill])).toEqual([
      { packagePath: "gno.land/r/gov/dao", eventCount: 3 },
      { packagePath: "gno.land/r/gnoland/blog", eventCount: 1 },
    ]);
  });
});
