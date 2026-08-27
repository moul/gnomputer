import { describe, it, expect } from "vitest";
import { isQuietChain } from "./block-explorer";

function blocks(...counts: number[]) {
  return counts.map((numTxs) => ({ numTxs }));
}

function empty(n: number) {
  return blocks(...Array.from({ length: n }, () => 0));
}

describe("isQuietChain", () => {
  it("says nothing while the feed is still filling up", () => {
    // The hint replaces no information — the feed is the app's whole point —
    // so it must not appear before there is enough of it to draw a conclusion
    // from. Two or three empty blocks happen on any chain.
    expect(isQuietChain([])).toBe(false);
    expect(isQuietChain(empty(1))).toBe(false);
    expect(isQuietChain(empty(7))).toBe(false);
  });

  it("speaks up once every block seen has been empty", () => {
    // Pearl produces a block every few seconds but had 150 transactions in its
    // first 8,000, so the unfiltered feed was a wall of "0 transactions" with
    // the answer sitting unnoticed in a checkbox above it.
    expect(isQuietChain(empty(8))).toBe(true);
    expect(isQuietChain(empty(40))).toBe(true);
  });

  it("stays quiet when the chain is demonstrably not", () => {
    // A single transaction anywhere in view proves the feed is working, which
    // is exactly what the hint would be denying.
    expect(isQuietChain(blocks(0, 0, 0, 0, 0, 0, 0, 1))).toBe(false);
    expect(isQuietChain(blocks(3, 0, 0, 0, 0, 0, 0, 0))).toBe(false);
  });
});
