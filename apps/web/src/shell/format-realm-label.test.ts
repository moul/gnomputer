import { describe, it, expect } from "vitest";
import { formatRealmLabel } from "./format-realm-label";

describe("formatRealmLabel", () => {
  it("strips the leading domain and returns the rest unchanged when it already fits", () => {
    expect(formatRealmLabel("gno.land/r/demo/foo")).toBe("r/demo/foo");
  });

  it("leaves a path with no domain segment (no slash before the first real segment) unchanged", () => {
    expect(formatRealmLabel("bare")).toBe("bare");
  });

  it("shortens an early segment to the middle before ever touching the last segment", () => {
    const longSegment = "x".repeat(30);
    const result = formatRealmLabel(`gno.land/${longSegment}/final`);
    expect(result).toBe("x..x/final");
    expect(result.endsWith("/final")).toBe(true);
  });

  it("only shortens the last segment once every earlier segment is already minimal", () => {
    const longSegment = "x".repeat(30);
    const longLastSegment = "y".repeat(30);
    const result = formatRealmLabel(`gno.land/${longSegment}/${longLastSegment}`, 22);

    expect(result.length).toBeLessThanOrEqual(22);
    // Earlier segment bottomed out at its minimal 4-char form...
    expect(result.startsWith("x..x/")).toBe(true);
    // ...and only now does the last segment show truncation too.
    expect(result).toContain("..");
    expect(result).not.toContain(longLastSegment);
  });

  it("respects a smaller custom maxLength by shortening more aggressively", () => {
    const result = formatRealmLabel("gno.land/r/demo/really-long-name-here", 15);
    expect(result.length).toBeLessThanOrEqual(15);
    expect(result).not.toBe("r/demo/really-long-name-here");
  });

  it("can exceed maxLength when every segment is already at or below the minimum truncation budget", () => {
    // "r", "demo", "foo" are each already <= MIDDLE_SEGMENT_BUDGET (4), so
    // there's nothing left to shorten — the algorithm returns the path
    // unchanged rather than mangling an already-minimal segment.
    expect(formatRealmLabel("gno.land/r/demo/foo", 6)).toBe("r/demo/foo");
  });
});
