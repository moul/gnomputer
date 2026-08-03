import { describe, expect, it } from "vitest";
import { MAX_BLOCKS_SHOWN, heightsToFetch } from "./use-live-activity";

describe("heightsToFetch", () => {
  it("fills the whole window on the first tick", () => {
    // The point of the change: opening the Block Explorer used to show
    // "Watching the chain for new blocks…" and then grow one row every five
    // seconds, for a list that is entirely about recent history. The ring
    // buffer was already there; nothing primed it.
    const heights = heightsToFetch(null, 1000);
    expect(heights).toHaveLength(MAX_BLOCKS_SHOWN);
    expect(heights[0]).toBe(1000 - MAX_BLOCKS_SHOWN + 1);
    expect(heights.at(-1)).toBe(1000);
  });

  it("only picks up what is new after that", () => {
    expect(heightsToFetch(1000, 1002)).toEqual([1001, 1002]);
  });

  it("fetches nothing when the tip has not moved", () => {
    expect(heightsToFetch(1000, 1000)).toEqual([]);
  });

  it("fetches nothing if the tip somehow goes backwards", () => {
    // A node behind a load balancer can answer with a lower height than the
    // one before it; that is not a reason to re-fetch anything.
    expect(heightsToFetch(1000, 998)).toEqual([]);
  });

  it("caps a long catch-up rather than firing hundreds of requests", () => {
    // Coming back to a tab hidden for an hour: the gap is thousands of
    // blocks and none of them belong in a twelve-row list.
    const heights = heightsToFetch(1000, 5000);
    expect(heights).toEqual([4996, 4997, 4998, 4999, 5000]);
  });

  it("never asks for a height below 1, on a chain younger than the window", () => {
    // Genesis + a few blocks, which is every fresh gnodev.
    const heights = heightsToFetch(null, 3);
    expect(heights).toEqual([1, 2, 3]);
  });

  it("returns heights in ascending order, so the caller reverses once", () => {
    const heights = heightsToFetch(null, 500);
    expect([...heights].sort((a, b) => a - b)).toEqual(heights);
  });
});
