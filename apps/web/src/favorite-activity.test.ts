import { describe, it, expect } from "vitest";
import { scanActivity } from "./favorite-activity";

const tx = (height: number, ...packagePaths: string[]) => ({ height, packagePaths });
const ev = (height: number, pkgPath: string | null) => ({ height, pkgPath });

describe("scanActivity", () => {
  it("reports the most recent height a package was called at", () => {
    const scan = scanActivity(
      [tx(300, "gno.land/r/demo/a"), tx(100, "gno.land/r/demo/a")],
      []
    );
    expect(scan.byPath.get("gno.land/r/demo/a")).toEqual({ lastHeight: 300, callCount: 2 });
  });

  it("credits every realm a multi-realm transaction touched", () => {
    // packagePaths is what the transaction invoked, so a tx crossing three
    // realms counts for all three — which is what "was my realm involved"
    // means.
    const scan = scanActivity([tx(500, "r/gnoswap/router", "r/gnoswap/pool")], []);
    expect(scan.byPath.get("r/gnoswap/router")?.callCount).toBe(1);
    expect(scan.byPath.get("r/gnoswap/pool")?.callCount).toBe(1);
  });

  it("counts a realm named twice in one transaction as one call", () => {
    const scan = scanActivity([tx(500, "r/demo/a", "r/demo/a")], []);
    expect(scan.byPath.get("r/demo/a")?.callCount).toBe(1);
  });

  it("finds a realm that is called but emits nothing of its own", () => {
    // r/gnops/valopers on Pearl: 83 direct calls, zero events. An
    // events-only watchlist reported a plainly active realm as dead (#211).
    const scan = scanActivity([tx(8_000, "gno.land/r/gnops/valopers")], []);
    expect(scan.byPath.get("gno.land/r/gnops/valopers")).toEqual({
      lastHeight: 8_000,
      callCount: 1,
    });
  });

  it("finds a package that only ever appears as an event emitter", () => {
    // The mirror-image blind spot. Calling r/gnoswap/gns emits Transfer under
    // p/demo/tokens/grc20, so a library busy on a chain's behalf shows up in
    // events and never in packagePaths (#210).
    const scan = scanActivity([], [ev(9_000, "gno.land/p/demo/tokens/grc20")]);
    expect(scan.byPath.get("gno.land/p/demo/tokens/grc20")).toEqual({
      lastHeight: 9_000,
      // Zero is a real answer here, not missing data: it was never *called*.
      callCount: 0,
    });
  });

  it("takes the newer height when the two sources disagree", () => {
    const scan = scanActivity([tx(100, "r/demo/a")], [ev(400, "r/demo/a")]);
    expect(scan.byPath.get("r/demo/a")?.lastHeight).toBe(400);
    expect(scan.byPath.get("r/demo/a")?.callCount).toBe(1);
  });

  it("uses the maximum height rather than whichever arrived last", () => {
    // Neither source is guaranteed sorted, and a caller that widened its
    // window can return an older batch after a newer one.
    const scan = scanActivity([tx(100, "r/demo/a"), tx(900, "r/demo/a"), tx(200, "r/demo/a")], []);
    expect(scan.byPath.get("r/demo/a")?.lastHeight).toBe(900);
  });

  it("reports how far back it looked, across both sources", () => {
    // The honest bound on "no recent activity": absence means "not in this
    // window", never "never".
    const scan = scanActivity([tx(500, "r/demo/a")], [ev(310, "r/demo/b")]);
    expect(scan.oldestScanned).toBe(310);
  });

  it("reports null when neither source returned anything", () => {
    expect(scanActivity([], []).oldestScanned).toBeNull();
    expect(scanActivity([], []).byPath.size).toBe(0);
  });

  it("ignores an event with no package path", () => {
    // Live Topaz really does send events with fields missing.
    const scan = scanActivity([], [ev(400, null), ev(410, "r/demo/a")]);
    expect(scan.byPath.size).toBe(1);
    // Still counted toward how far back the scan reached, though — the block
    // was examined whether or not its event was usable.
    expect(scan.oldestScanned).toBe(400);
  });
});
