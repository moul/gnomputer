import { describe, it, expect } from "vitest";
import { blockToTransactions } from "./use-live-transactions";
import type { BlockEvents } from "@gnomputer/app-sdk";

function fakeBlock(): BlockEvents {
  return {
    height: 168007,
    txs: [
      {
        txIndex: 0,
        success: true,
        gasWanted: 2_000_000,
        gasUsed: 143_221,
        events: [
          { type: "Transfer", pkgPath: "gno.land/r/demo/defi/grc20reg", attrs: [] },
          { type: "Transfer", pkgPath: "gno.land/r/demo/defi/grc20reg", attrs: [] },
        ],
      },
      {
        txIndex: 1,
        success: false,
        gasWanted: 500_000,
        gasUsed: 500_000,
        events: [],
      },
    ],
  };
}

describe("blockToTransactions", () => {
  it("maps one row per transaction, not per event", () => {
    const rows = blockToTransactions(fakeBlock());
    expect(rows).toHaveLength(2);
  });

  it("dedupes package paths across a tx's events", () => {
    const [first] = blockToTransactions(fakeBlock());
    expect(first!.pkgPaths).toEqual(["gno.land/r/demo/defi/grc20reg"]);
  });

  it("carries success/gas fields through unchanged", () => {
    const [, second] = blockToTransactions(fakeBlock());
    expect(second).toEqual({
      height: 168007,
      txIndex: 1,
      success: false,
      gasWanted: 500_000,
      gasUsed: 500_000,
      eventCount: 0,
      pkgPaths: [],
    });
  });
});
