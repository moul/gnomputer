import { describe, it, expect, vi, afterEach } from "vitest";
import { countPackagesByCreator, listRealms, realmHistory, chainActivityStats, dailyActivity } from "./indexer";

const NETWORK = { id: "topaz", indexerGraphqlUrl: "https://indexer.example/graphql/query" };
const NOW = "2026-07-24T00:00:00.000Z";

function mockIndexerResponse(data: unknown, errors?: { message: string }[]) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data, errors }),
  }) as unknown as typeof fetch;
}

describe("countPackagesByCreator", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("counts distinct package paths across matching transactions", async () => {
    mockIndexerResponse({
      getTransactions: [
        { messages: [{ value: { package: { path: "gno.land/r/demo/a" } } }] },
        { messages: [{ value: { package: { path: "gno.land/r/demo/b" } } }] },
        // A duplicate path (e.g. re-deployed) should only count once.
        { messages: [{ value: { package: { path: "gno.land/r/demo/a" } } }] },
      ],
    });

    const result = await countPackagesByCreator(NETWORK, "g1abc", NOW);

    expect(result.data.count).toBe(2);
    expect(result.source).toBe("indexer");
    expect(result.ref.objectId).toBe("g1abc");
  });

  it("returns a count of 0 when there are no matching transactions", async () => {
    mockIndexerResponse({ getTransactions: [] });
    const result = await countPackagesByCreator(NETWORK, "g1abc", NOW);
    expect(result.data.count).toBe(0);
  });

  it("returns a count of 0 when getTransactions is null (confirmed live behavior for zero matches, not [])", async () => {
    mockIndexerResponse({ getTransactions: null });
    const result = await countPackagesByCreator(NETWORK, "g1abc", NOW);
    expect(result.data.count).toBe(0);
  });

  it("ignores messages with no package path (defensive against a null value)", async () => {
    mockIndexerResponse({
      getTransactions: [{ messages: [{ value: null }, { value: { package: { path: "gno.land/r/demo/a" } } }] }],
    });
    const result = await countPackagesByCreator(NETWORK, "g1abc", NOW);
    expect(result.data.count).toBe(1);
  });

  it("throws when the network has no indexer configured", async () => {
    await expect(countPackagesByCreator({ id: "gnodev" }, "g1abc", NOW)).rejects.toThrow(
      "gnodev has no indexer configured"
    );
  });

  it("throws the GraphQL error message when the query itself fails", async () => {
    mockIndexerResponse(null, [{ message: "field creator is not filterable" }]);
    await expect(countPackagesByCreator(NETWORK, "g1abc", NOW)).rejects.toThrow(
      "field creator is not filterable"
    );
  });

  it("throws a transport error when the HTTP response isn't ok", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: "Internal Server Error" });
    await expect(countPackagesByCreator(NETWORK, "g1abc", NOW)).rejects.toThrow("500");
  });
});

describe("listRealms", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("keeps only the highest block height per realm path, sorted most-recent-first", async () => {
    mockIndexerResponse({
      getTransactions: [
        { block_height: 100, messages: [{ value: { package: { path: "gno.land/r/demo/a" } } }] },
        { block_height: 200, messages: [{ value: { package: { path: "gno.land/r/demo/a" } } }] },
        { block_height: 150, messages: [{ value: { package: { path: "gno.land/r/demo/b" } } }] },
      ],
    });

    const result = await listRealms(NETWORK, NOW);

    expect(result.data).toEqual([
      { packagePath: "gno.land/r/demo/a", blockHeight: 200 },
      { packagePath: "gno.land/r/demo/b", blockHeight: 150 },
    ]);
  });

  it("excludes packages whose path doesn't contain /r/ (e.g. a /p/ library package)", async () => {
    mockIndexerResponse({
      getTransactions: [
        { block_height: 100, messages: [{ value: { package: { path: "gno.land/p/demo/lib" } } }] },
        { block_height: 100, messages: [{ value: { package: { path: "gno.land/r/demo/a" } } }] },
      ],
    });

    const result = await listRealms(NETWORK, NOW);

    expect(result.data).toEqual([{ packagePath: "gno.land/r/demo/a", blockHeight: 100 }]);
  });

  it("respects the limit parameter", async () => {
    mockIndexerResponse({
      getTransactions: Array.from({ length: 5 }, (_, i) => ({
        block_height: i,
        messages: [{ value: { package: { path: `gno.land/r/demo/${i}` } } }],
      })),
    });

    const result = await listRealms(NETWORK, NOW, 2);

    expect(result.data).toHaveLength(2);
  });

  it("throws when the network has no indexer configured", async () => {
    await expect(listRealms({ id: "gnodev" }, NOW)).rejects.toThrow("gnodev has no indexer configured");
  });

  it("returns an empty list when getTransactions is null (confirmed live behavior for zero matches)", async () => {
    mockIndexerResponse({ getTransactions: null });
    const result = await listRealms(NETWORK, NOW);
    expect(result.data).toEqual([]);
  });
});

describe("realmHistory", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("extracts this realm's own GnoEvents, most recent first", async () => {
    mockIndexerResponse({
      getTransactions: [
        {
          block_height: 200,
          index: 0,
          response: {
            events: [
              { type: "Transfer", pkg_path: "gno.land/r/demo/a", attrs: [{ key: "to", value: "g1abc" }] },
            ],
          },
        },
      ],
    });

    const result = await realmHistory(NETWORK, "gno.land/r/demo/a", NOW);

    expect(result.data).toEqual([
      { height: 200, txIndex: 0, type: "Transfer", attrs: [{ key: "to", value: "g1abc" }] },
    ]);
    expect(result.source).toBe("indexer");
  });

  it("ignores events belonging to a different package (a nested call touching another realm)", async () => {
    mockIndexerResponse({
      getTransactions: [
        {
          block_height: 200,
          index: 0,
          response: {
            events: [
              { type: "Approval", pkg_path: "gno.land/p/demo/tokens/grc20", attrs: [] },
              { type: "Swap", pkg_path: "gno.land/r/demo/a", attrs: [] },
            ],
          },
        },
      ],
    });

    const result = await realmHistory(NETWORK, "gno.land/r/demo/a", NOW);

    expect(result.data).toEqual([{ height: 200, txIndex: 0, type: "Swap", attrs: [] }]);
  });

  it("skips non-GnoEvent union members that come back as an empty object", async () => {
    mockIndexerResponse({
      getTransactions: [
        {
          block_height: 200,
          index: 0,
          response: { events: [{}, { type: "Transfer", pkg_path: "gno.land/r/demo/a", attrs: [] }] },
        },
      ],
    });

    const result = await realmHistory(NETWORK, "gno.land/r/demo/a", NOW);

    expect(result.data).toEqual([{ height: 200, txIndex: 0, type: "Transfer", attrs: [] }]);
  });

  it("returns an empty list when getTransactions is null", async () => {
    mockIndexerResponse({ getTransactions: null });
    const result = await realmHistory(NETWORK, "gno.land/r/demo/a", NOW);
    expect(result.data).toEqual([]);
  });

  it("respects the limit parameter", async () => {
    mockIndexerResponse({
      getTransactions: Array.from({ length: 5 }, (_, i) => ({
        block_height: i,
        index: 0,
        response: { events: [{ type: "Transfer", pkg_path: "gno.land/r/demo/a", attrs: [] }] },
      })),
    });

    const result = await realmHistory(NETWORK, "gno.land/r/demo/a", NOW, 2);

    expect(result.data).toHaveLength(2);
  });

  it("throws when the network has no indexer configured", async () => {
    await expect(realmHistory({ id: "gnodev" }, "gno.land/r/demo/a", NOW)).rejects.toThrow(
      "gnodev has no indexer configured"
    );
  });
});

describe("chainActivityStats", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("aggregates totals, per-realm gas, top gas transactions, and top callers/deployers", async () => {
    mockIndexerResponse({
      getTransactions: [
        {
          block_height: 100,
          index: 0,
          gas_used: 500,
          gas_wanted: 600,
          gas_fee: { amount: 10 },
          messages: [
            { typeUrl: "exec", value: { pkg_path: "gno.land/r/demo/a", caller: "g1abc" } },
            { typeUrl: "exec", value: { pkg_path: "gno.land/r/demo/b", caller: "g1abc" } },
          ],
        },
        {
          block_height: 101,
          index: 0,
          gas_used: 1000,
          gas_wanted: 1200,
          gas_fee: { amount: 20 },
          messages: [{ typeUrl: "add_package", value: { creator: "g1xyz", package: { path: "gno.land/r/demo/c" } } }],
        },
        {
          block_height: 102,
          index: 0,
          gas_used: 50,
          gas_wanted: 60,
          gas_fee: { amount: 1 },
          messages: [{ typeUrl: "run", value: { caller: "g1xyz" } }],
        },
        {
          block_height: 103,
          index: 0,
          gas_used: 30,
          gas_wanted: 40,
          gas_fee: { amount: 1 },
          messages: [{ typeUrl: "send", value: null }],
        },
      ],
    });

    const result = await chainActivityStats(NETWORK, NOW);

    expect(result.data.totalTxs).toBe(4);
    expect(result.data.totalCalls).toBe(2);
    expect(result.data.totalDeploys).toBe(1);
    expect(result.data.totalRuns).toBe(1);
    expect(result.data.totalSends).toBe(1);
    expect(result.data.totalGasUsed).toBe(500 + 1000 + 50 + 30);
    expect(result.data.totalFeeUgnot).toBe(10 + 20 + 1 + 1);
    // The two-message tx's full gas (500) counts toward BOTH realms it touched.
    expect(result.data.topRealmsByGas).toEqual(
      expect.arrayContaining([
        { packagePath: "gno.land/r/demo/a", gasUsed: 500, txCount: 1 },
        { packagePath: "gno.land/r/demo/b", gasUsed: 500, txCount: 1 },
        { packagePath: "gno.land/r/demo/c", gasUsed: 1000, txCount: 1 },
      ])
    );
    expect(result.data.topTxsByGas[0]).toMatchObject({ height: 101, gasUsed: 1000 });
    expect(result.data.topCallers).toEqual([{ address: "g1abc", count: 2 }]);
    expect(result.data.topDeployers).toEqual([{ address: "g1xyz", count: 1 }]);
  });

  it("returns zeroed stats when getTransactions is null", async () => {
    mockIndexerResponse({ getTransactions: null });
    const result = await chainActivityStats(NETWORK, NOW);
    expect(result.data.totalTxs).toBe(0);
    expect(result.data.topRealmsByGas).toEqual([]);
    expect(result.data.topCallers).toEqual([]);
  });

  it("throws when the network has no indexer configured", async () => {
    await expect(chainActivityStats({ id: "gnodev" }, NOW)).rejects.toThrow("gnodev has no indexer configured");
  });
});

describe("dailyActivity", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("buckets blocks by UTC calendar date, sorted oldest first", async () => {
    mockIndexerResponse({
      getBlocks: [
        { time: "2026-07-20T10:00:00.000Z", num_txs: 3 },
        { time: "2026-07-21T05:00:00.000Z", num_txs: 1 },
        { time: "2026-07-20T23:59:00.000Z", num_txs: 2 },
      ],
    });

    const result = await dailyActivity(NETWORK, NOW);

    expect(result.data).toEqual([
      { date: "2026-07-20", blockCount: 2, txCount: 5 },
      { date: "2026-07-21", blockCount: 1, txCount: 1 },
    ]);
  });

  it("returns an empty list when getBlocks is null", async () => {
    mockIndexerResponse({ getBlocks: null });
    const result = await dailyActivity(NETWORK, NOW);
    expect(result.data).toEqual([]);
  });

  it("throws when the network has no indexer configured", async () => {
    await expect(dailyActivity({ id: "gnodev" }, NOW)).rejects.toThrow("gnodev has no indexer configured");
  });
});
