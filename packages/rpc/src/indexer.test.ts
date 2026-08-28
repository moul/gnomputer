import { describe, it, expect, vi, afterEach } from "vitest";
import {
  countPackagesByCreator,
  listRealms,
  realmHistory,
  chainActivityStats,
  dailyActivity,
  listTransactions,
  listBlockHeightsWithTxs,
  recentEvents,
  blockTransactions,
} from "./indexer";

import FIXTURES from "./__fixtures__/indexer-block-transactions.json";

const NETWORK = { id: "topaz", indexerGraphqlUrl: "https://indexer.example/graphql/query" };
const NOW = "2026-07-24T00:00:00.000Z";

/** dailyActivity makes TWO requests: latestBlockHeight, then the bounded
 * block query. The height comes first and decides the window. */
function mockDailyActivity(latestBlockHeight: number, data: unknown) {
  const responses = [{ data: { latestBlockHeight } }, { data }];
  global.fetch = vi.fn().mockImplementation(() =>
    Promise.resolve({ ok: true, json: async () => responses.shift() ?? { data: {} } })
  ) as unknown as typeof fetch;
}

function mockIndexerResponse(data: unknown, errors?: { message: string }[]) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data, errors }),
  }) as unknown as typeof fetch;
}

/** realmHistory and recentEvents ask for latestBlockHeight first, then run the
 * height-bounded event query — which they may repeat at a wider window when the
 * narrow one held too few events, so every request after the first answers with
 * the same payload. */
function mockEventScan(data: unknown, latestBlockHeight = 500_000) {
  let first = true;
  global.fetch = vi.fn().mockImplementation(() =>
    Promise.resolve({
      ok: true,
      json: async () => {
        if (first) {
          first = false;
          return { data: { latestBlockHeight } };
        }
        return { data };
      },
    })
  ) as unknown as typeof fetch;
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
    mockEventScan({
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
    mockEventScan({
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
    mockEventScan({
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
    mockEventScan({ getTransactions: null });
    const result = await realmHistory(NETWORK, "gno.land/r/demo/a", NOW);
    expect(result.data).toEqual([]);
  });

  it("respects the limit parameter", async () => {
    mockEventScan({
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

  it("stops at the first window for a busy realm whose events belong to another package", async () => {
    // Caught in a browser, not by a fixture. A realm's own GnoEvents are often
    // a small minority of what its calls emit: gnoswap/gns emits Transfer and
    // Approval under `p/demo/tokens/grc20`, so 107 calls in 2,000 blocks
    // produced almost nothing attributed to gns itself. Counting only
    // own-events never reached the limit, so every view of an active realm
    // walked the ladder to the genesis rung — the unbounded scan this whole
    // change exists to avoid. Matching calls count too.
    const bodies: string[] = [];
    global.fetch = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      bodies.push(String(init.body));
      if (bodies.length === 1) {
        return Promise.resolve({ ok: true, json: async () => ({ data: { latestBlockHeight: 492_541 } }) });
      }
      const getTransactions = Array.from({ length: 107 }, (_, i) => ({
        block_height: 492_400 + i,
        index: 0,
        // Emitted by the grc20 package, not by the realm being viewed.
        response: { events: [{ type: "Transfer", pkg_path: "gno.land/p/demo/tokens/grc20", attrs: [] }] },
      }));
      return Promise.resolve({ ok: true, json: async () => ({ data: { getTransactions } }) });
    }) as unknown as typeof fetch;

    const result = await realmHistory(NETWORK, "gno.land/r/gnoswap/gns", NOW);

    // One height lookup plus one window — no ladder walk.
    expect(bodies).toHaveLength(2);
    // And the events still belong to the realm asked about, so none survive.
    expect(result.data).toEqual([]);
  });

  it("keeps widening back to genesis for a realm that was last called long ago", async () => {
    // Unlike the chain-wide scans, this one is filtered to a single realm, so
    // the last rung may safely reach height 0: it is only used when the
    // narrower windows found nothing, which means the realm is quiet, which
    // means a full scan cannot approach the row cap. Without it, a realm last
    // touched 400,000 blocks ago reported an empty history rather than an old
    // one.
    const bodies: string[] = [];
    global.fetch = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      bodies.push(String(init.body));
      if (bodies.length === 1) {
        return Promise.resolve({ ok: true, json: async () => ({ data: { latestBlockHeight: 492_437 } }) });
      }
      const { fromHeight } = JSON.parse(String(init.body)).variables;
      const getTransactions =
        fromHeight === 0
          ? [
              {
                block_height: 12,
                index: 0,
                response: { events: [{ type: "Deployed", pkg_path: "gno.land/r/demo/a", attrs: [] }] },
              },
            ]
          : [];
      return Promise.resolve({ ok: true, json: async () => ({ data: { getTransactions } }) });
    }) as unknown as typeof fetch;

    const result = await realmHistory(NETWORK, "gno.land/r/demo/a", NOW);

    expect(JSON.parse(bodies[1]!).variables).toMatchObject({ fromHeight: 490_437 });
    expect(JSON.parse(bodies[2]!).variables).toMatchObject({ fromHeight: 472_437 });
    expect(JSON.parse(bodies[3]!).variables).toMatchObject({ fromHeight: 292_437 });
    expect(JSON.parse(bodies[4]!).variables).toMatchObject({ fromHeight: 0 });
    // The realm path travels with every attempt, not just the first.
    expect(JSON.parse(bodies[4]!).variables.pkgPath).toBe("gno.land/r/demo/a");
    expect(result.data).toEqual([{ height: 12, txIndex: 0, type: "Deployed", attrs: [] }]);
  });
});

describe("recentEvents", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("extracts every successful transaction's GnoEvents, most recent first, with pkgPath attached", async () => {
    mockEventScan({
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
        {
          block_height: 150,
          index: 1,
          response: { events: [{ type: "Swap", pkg_path: "gno.land/r/demo/b", attrs: [] }] },
        },
      ],
    });

    const result = await recentEvents(NETWORK, NOW);

    expect(result.data).toEqual([
      { height: 200, txIndex: 0, type: "Transfer", pkgPath: "gno.land/r/demo/a", attrs: [{ key: "to", value: "g1abc" }] },
      { height: 150, txIndex: 1, type: "Swap", pkgPath: "gno.land/r/demo/b", attrs: [] },
    ]);
    expect(result.source).toBe("indexer");
  });

  it("skips non-GnoEvent union members that come back with no type/pkg_path", async () => {
    mockEventScan({
      getTransactions: [
        {
          block_height: 200,
          index: 0,
          response: { events: [{}, { type: "Transfer", pkg_path: "gno.land/r/demo/a", attrs: [] }] },
        },
      ],
    });

    const result = await recentEvents(NETWORK, NOW);

    expect(result.data).toEqual([{ height: 200, txIndex: 0, type: "Transfer", pkgPath: "gno.land/r/demo/a", attrs: [] }]);
  });

  it("returns an empty list when getTransactions is null", async () => {
    mockEventScan({ getTransactions: null });
    const result = await recentEvents(NETWORK, NOW);
    expect(result.data).toEqual([]);
  });

  it("respects the limit parameter", async () => {
    mockEventScan({
      getTransactions: Array.from({ length: 5 }, (_, i) => ({
        block_height: i,
        index: 0,
        response: { events: [{ type: "Transfer", pkg_path: "gno.land/r/demo/a", attrs: [] }] },
      })),
    });

    const result = await recentEvents(NETWORK, NOW, 2);

    expect(result.data).toHaveLength(2);
  });

  it("throws when the network has no indexer configured", async () => {
    await expect(recentEvents({ id: "gnodev" }, NOW)).rejects.toThrow("gnodev has no indexer configured");
  });

  it("bounds the scan by height instead of asking for the chain's whole history", async () => {
    // Unbounded, this matched every successful transaction ever. Past ten
    // thousand the indexer answers `max elements per query reached (10000)` in
    // `errors`, which is a failed query here — so the Event Explorer sat on
    // "Loading recent events…" forever. Confirmed live on Sapphire, and Topaz
    // did not answer an unbounded scan within two minutes at all.
    const bodies: string[] = [];
    global.fetch = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      bodies.push(String(init.body));
      if (bodies.length === 1) {
        return Promise.resolve({ ok: true, json: async () => ({ data: { latestBlockHeight: 492_437 } }) });
      }
      const getTransactions = Array.from({ length: 60 }, (_, i) => ({
        block_height: 492_000 + i,
        index: 0,
        response: { events: [{ type: "Transfer", pkg_path: "gno.land/r/demo/a", attrs: [] }] },
      }));
      return Promise.resolve({ ok: true, json: async () => ({ data: { getTransactions } }) });
    }) as unknown as typeof fetch;

    await recentEvents(NETWORK, NOW);

    expect(bodies[0]).toContain("latestBlockHeight");
    // Relative to the tip, and narrow enough to stay well under the cap.
    expect(JSON.parse(bodies[1]!).variables).toEqual({ fromHeight: 490_437 });
    // 60 events already fills the 40-event default, so it stops at one window.
    expect(bodies).toHaveLength(2);
  });

  it("widens the window when the narrow one held too few events", async () => {
    const bodies: string[] = [];
    global.fetch = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      bodies.push(String(init.body));
      if (bodies.length === 1) {
        return Promise.resolve({ ok: true, json: async () => ({ data: { latestBlockHeight: 100_000 } }) });
      }
      const { fromHeight } = JSON.parse(String(init.body)).variables;
      const count = fromHeight === 98_000 ? 3 : 50;
      const getTransactions = Array.from({ length: count }, (_, i) => ({
        block_height: 90_000 + i,
        index: 0,
        response: { events: [{ type: "Transfer", pkg_path: "gno.land/r/demo/a", attrs: [] }] },
      }));
      return Promise.resolve({ ok: true, json: async () => ({ data: { getTransactions } }) });
    }) as unknown as typeof fetch;

    const result = await recentEvents(NETWORK, NOW);

    expect(JSON.parse(bodies[1]!).variables).toEqual({ fromHeight: 98_000 });
    expect(JSON.parse(bodies[2]!).variables).toEqual({ fromHeight: 80_000 });
    expect(bodies).toHaveLength(3);
    expect(result.data).toHaveLength(40);
  });
});

/** chainActivityStats asks for latestBlockHeight first, then the bounded
 * transaction query — which it may repeat at a wider window on a quiet chain,
 * so every request after the first answers with the same `data`. */
function mockDailyActivityStyle(data: unknown, latestBlockHeight = 500_000) {
  let first = true;
  global.fetch = vi.fn().mockImplementation(() =>
    Promise.resolve({
      ok: true,
      json: async () => {
        if (first) { first = false; return { data: { latestBlockHeight } }; }
        return { data };
      },
    })
  ) as unknown as typeof fetch;
}

describe("chainActivityStats", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("aggregates totals, per-realm gas, top gas transactions, and top callers/deployers", async () => {
    mockDailyActivityStyle({
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
    mockDailyActivityStyle({ getTransactions: null });
    const result = await chainActivityStats(NETWORK, NOW);
    expect(result.data.totalTxs).toBe(0);
    expect(result.data.topRealmsByGas).toEqual([]);
    expect(result.data.topCallers).toEqual([]);
  });

  it("throws when the network has no indexer configured", async () => {
    await expect(chainActivityStats({ id: "gnodev" }, NOW)).rejects.toThrow("gnodev has no indexer configured");
  });

  it("widens the window on a quiet chain instead of reporting a near-empty leaderboard", async () => {
    // Pearl, measured live at height 7,600: 24 transactions in the last 2,000
    // blocks but 142 in its whole history. Fixed at 2,000 the leaderboard
    // showed a handful of rows on the network a first visit now lands on, and
    // read as though the chain were dead.
    const bodies: string[] = [];
    global.fetch = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      bodies.push(String(init.body));
      if (bodies.length === 1) {
        return Promise.resolve({ ok: true, json: async () => ({ data: { latestBlockHeight: 7_600 } }) });
      }
      const { fromHeight } = JSON.parse(String(init.body)).variables;
      const count = fromHeight === 0 ? 142 : 24;
      const getTransactions = Array.from({ length: count }, (_, i) => ({
        block_height: 7_000 + i,
        index: 0,
        gas_used: 10,
        gas_wanted: 20,
        gas_fee: { amount: 1 },
        messages: [{ typeUrl: "exec", value: { pkg_path: "gno.land/r/demo/a", caller: "g1abc" } }],
      }));
      return Promise.resolve({ ok: true, json: async () => ({ data: { getTransactions } }) });
    }) as unknown as typeof fetch;

    const result = await chainActivityStats(NETWORK, NOW);

    expect(JSON.parse(bodies[1]!).variables).toEqual({ fromHeight: 5_600 });
    // Second attempt clamps at zero rather than asking for a negative height.
    expect(JSON.parse(bodies[2]!).variables).toEqual({ fromHeight: 0 });
    // And stops there: 20,000 already covers a 7,600-block chain, so a third
    // attempt would re-fetch the identical set.
    expect(bodies).toHaveLength(3);
    expect(result.data.totalTxs).toBe(142);
  });

  it("stops at the first window on a chain busy enough to fill it", async () => {
    // The widening must not cost a second round trip on Sapphire, which
    // already yields 1,961 transactions at the narrowest window.
    const bodies: string[] = [];
    global.fetch = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      bodies.push(String(init.body));
      if (bodies.length === 1) {
        return Promise.resolve({ ok: true, json: async () => ({ data: { latestBlockHeight: 500_000 } }) });
      }
      const getTransactions = Array.from({ length: 1_961 }, (_, i) => ({
        block_height: 499_000 + i,
        index: 0,
        gas_used: 10,
        gas_wanted: 20,
        gas_fee: { amount: 1 },
        messages: [{ typeUrl: "exec", value: { pkg_path: "gno.land/r/demo/a", caller: "g1abc" } }],
      }));
      return Promise.resolve({ ok: true, json: async () => ({ data: { getTransactions } }) });
    }) as unknown as typeof fetch;

    const result = await chainActivityStats(NETWORK, NOW);

    expect(bodies).toHaveLength(2);
    expect(result.data.totalTxs).toBe(1_961);
  });
});

describe("dailyActivity", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("buckets blocks by UTC calendar date, sorted oldest first", async () => {
    mockDailyActivity(500_000, {
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
    mockDailyActivity(500_000, { getBlocks: null });
    const result = await dailyActivity(NETWORK, NOW);
    expect(result.data).toEqual([]);
  });

  it("throws when the network has no indexer configured", async () => {
    await expect(dailyActivity({ id: "gnodev" }, NOW)).rejects.toThrow("gnodev has no indexer configured");
  });

  it("bounds the query to a recent window rather than the whole chain", async () => {
    // Unbounded, this took 58.5s against Topaz and never rendered — the
    // indexer scans the height range server-side, so cost tracks the range
    // rather than the rows returned (#138).
    const bodies: string[] = [];
    global.fetch = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      bodies.push(String(init.body));
      const response = bodies.length === 1 ? { latestBlockHeight: 500_000 } : { getBlocks: [] };
      return Promise.resolve({ ok: true, json: async () => ({ data: response }) });
    }) as unknown as typeof fetch;

    await dailyActivity(NETWORK, NOW);

    expect(bodies).toHaveLength(2);
    expect(bodies[0]).toContain("latestBlockHeight");
    // 500,000 - 100,000: the window is relative to the tip, not absolute.
    expect(JSON.parse(bodies[1]!).variables).toEqual({ fromHeight: 400_000 });
  });

  it("does not ask for a negative height on a young chain", async () => {
    const bodies: string[] = [];
    global.fetch = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      bodies.push(String(init.body));
      const response = bodies.length === 1 ? { latestBlockHeight: 42 } : { getBlocks: [] };
      return Promise.resolve({ ok: true, json: async () => ({ data: response }) });
    }) as unknown as typeof fetch;

    await dailyActivity(NETWORK, NOW);
    expect(JSON.parse(bodies[1]!).variables).toEqual({ fromHeight: 0 });
  });
});

/** listTransactions makes TWO requests: latestBlockHeight, then the bounded
 * transaction query — and widens the window when the first pass returns fewer
 * rows than the limit, so the same payload answers every attempt. */
function mockListTransactions(data: unknown, latestBlockHeight = 500_000) {
  let first = true;
  global.fetch = vi.fn().mockImplementation(() =>
    Promise.resolve({
      ok: true,
      json: async () => {
        if (first) {
          first = false;
          return { data: { latestBlockHeight } };
        }
        return { data };
      },
    })
  ) as unknown as typeof fetch;
}

describe("listTransactions", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("maps real fields and dedupes package paths across messages, including both success and failure", async () => {
    mockListTransactions({
      getTransactions: [
        {
          block_height: 200,
          index: 0,
          success: true,
          gas_used: 500,
          gas_wanted: 600,
          gas_fee: { amount: 10 },
          messages: [
            { value: { pkg_path: "gno.land/r/demo/a" } },
            { value: { pkg_path: "gno.land/r/demo/a" } },
            { value: { package: { path: "gno.land/r/demo/b" } } },
          ],
          response: { events: [{ type: "Transfer" }, {}] },
        },
        {
          block_height: 199,
          index: 0,
          success: false,
          gas_used: 100,
          gas_wanted: 200,
          gas_fee: { amount: 5 },
          messages: [{ value: null }],
          response: null,
        },
      ],
    });

    const result = await listTransactions(NETWORK, NOW);

    expect(result.data).toEqual([
      {
        height: 200,
        txIndex: 0,
        success: true,
        gasUsed: 500,
        gasWanted: 600,
        feeUgnot: 10,
        packagePaths: ["gno.land/r/demo/a", "gno.land/r/demo/b"],
        eventCount: 2,
      },
      {
        height: 199,
        txIndex: 0,
        success: false,
        gasUsed: 100,
        gasWanted: 200,
        feeUgnot: 5,
        packagePaths: [],
        eventCount: 0,
      },
    ]);
  });

  it("respects the limit parameter", async () => {
    mockListTransactions({
      getTransactions: Array.from({ length: 5 }, (_, i) => ({
        block_height: i,
        index: 0,
        success: true,
        gas_used: 1,
        gas_wanted: 1,
        gas_fee: { amount: 1 },
        messages: [],
        response: { events: [] },
      })),
    });

    const result = await listTransactions(NETWORK, NOW, 2);

    expect(result.data).toHaveLength(2);
  });

  it("returns an empty list when getTransactions is null", async () => {
    mockListTransactions({ getTransactions: null });
    const result = await listTransactions(NETWORK, NOW);
    expect(result.data).toEqual([]);
  });

  it("throws when the network has no indexer configured", async () => {
    await expect(listTransactions({ id: "gnodev" }, NOW)).rejects.toThrow("gnodev has no indexer configured");
  });
});

describe("indexer response validation", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("rejects a non-JSON response instead of casting it into a typed value", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        throw new SyntaxError("Unexpected token < in JSON");
      },
    }) as unknown as typeof fetch;

    // A proxy or error page returning HTML used to become `undefined` data
    // and fail later somewhere unrelated.
    await expect(listRealms(NETWORK, NOW)).rejects.toThrow(/non-JSON response/);
  });

  it("rejects a response whose data isn't an object", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: null }),
    }) as unknown as typeof fetch;

    await expect(listRealms(NETWORK, NOW)).rejects.toThrow(/no data/);
  });

  it("names the endpoint host so the error is actionable", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => "not an object",
    }) as unknown as typeof fetch;

    await expect(listRealms(NETWORK, NOW)).rejects.toThrow(/indexer\.example/);
  });

  it("still surfaces a real GraphQL error message", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ errors: [{ message: "field is not filterable" }] }),
    }) as unknown as typeof fetch;

    await expect(listRealms(NETWORK, NOW)).rejects.toThrow("field is not filterable");
  });

  it("tolerates a malformed errors entry rather than throwing on undefined.message", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ errors: [null] }),
    }) as unknown as typeof fetch;

    await expect(listRealms(NETWORK, NOW)).rejects.toThrow("Indexer query failed");
  });
});

describe("per-query field validation", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("rejects a field whose type changed, naming the field", async () => {
    // Before this, `json.data as T` meant a string where a number belonged
    // became a "valid" typed value and blew up later, somewhere unrelated,
    // as a confusing TypeError (AUD-022).
    mockIndexerResponse({
      getTransactions: [
        { block_height: "200", messages: [{ value: { package: { path: "gno.land/r/demo/a" } } }] },
      ],
    });

    await expect(listRealms(NETWORK, NOW)).rejects.toThrow(
      /getTransactions\.0\.block_height/
    );
  });

  it("rejects a missing required field rather than yielding undefined", async () => {
    mockIndexerResponse({ getTransactions: [{ block_height: 200 }] });
    await expect(listRealms(NETWORK, NOW)).rejects.toThrow(/getTransactions\.0\.messages/);
  });

  it("names the endpoint, so it is obvious which service is wrong", async () => {
    mockIndexerResponse({ getTransactions: "not an array" });
    await expect(listRealms(NETWORK, NOW)).rejects.toThrow(/indexer\.example/);
  });

  it("still accepts the null the indexer really returns for no matches", async () => {
    // getTransactions is null, not [], when nothing matches — confirmed live.
    // A schema that forgot this would break the most common case.
    mockIndexerResponse({ getTransactions: null });
    await expect(listRealms(NETWORK, NOW)).resolves.toMatchObject({ data: [] });
  });
});

describe("listBlockHeightsWithTxs", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns distinct heights, newest first", async () => {
    mockIndexerResponse({
      getTransactions: [
        { block_height: 300 },
        { block_height: 300 },
        { block_height: 288 },
        { block_height: 271 },
      ],
    });
    const result = await listBlockHeightsWithTxs(NETWORK, NOW);
    expect(result.data).toEqual([300, 288, 271]);
  });

  it("de-duplicates before applying the cap, not after", async () => {
    // Slicing first would return two blocks when three were asked for, just
    // because one block happened to hold several transactions.
    mockIndexerResponse({
      getTransactions: [
        { block_height: 300 },
        { block_height: 300 },
        { block_height: 300 },
        { block_height: 288 },
        { block_height: 271 },
        { block_height: 264 },
      ],
    });
    const result = await listBlockHeightsWithTxs(NETWORK, NOW, 3);
    expect(result.data).toEqual([300, 288, 271]);
  });

  it("asks only for block_height", async () => {
    // The equivalent full transaction query returns about 1MB on Topaz; this
    // one returns 54KB. Requesting a field nobody reads would quietly give
    // that back.
    let sentQuery = "";
    global.fetch = (async (_url: string, init: { body: string }) => {
      sentQuery = JSON.parse(init.body).query as string;
      return { ok: true, status: 200, json: async () => ({ data: { getTransactions: [] } }) };
    }) as unknown as typeof global.fetch;

    await listBlockHeightsWithTxs(NETWORK, NOW);

    expect(sentQuery).toContain("block_height");
    for (const field of ["gas_used", "messages", "response", "success", "index"]) {
      expect(sentQuery, `should not request ${field}`).not.toContain(field);
    }
  });

  it("is empty rather than throwing when the indexer returns null", async () => {
    mockIndexerResponse({ getTransactions: null });
    expect((await listBlockHeightsWithTxs(NETWORK, NOW)).data).toEqual([]);
  });

  it("refuses a network with no indexer, naming it", async () => {
    await expect(
      listBlockHeightsWithTxs({ id: "gnodev" }, NOW)
    ).rejects.toThrow(/gnodev has no indexer/);
  });

  it("reports itself as indexer-derived, not live chain state", async () => {
    mockIndexerResponse({ getTransactions: [{ block_height: 1 }] });
    const result = await listBlockHeightsWithTxs(NETWORK, NOW);
    expect(result.source).toBe("indexer");
    expect(result.consistency).toBe("indexed");
  });
});

describe("blockTransactions", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("decodes a real bank transfer, which block_results cannot describe at all", () => {
    // Topaz block 467231. The RPC path reports this as "Tx #0 · success,
    // gas 1,238,416" and nothing else — the 15 GNOT actually moving between
    // two accounts is invisible there.
    mockIndexerResponse(FIXTURES.bankSend.response.data);
    return blockTransactions(NETWORK, 467231, NOW).then((env) => {
      expect(env.data).toHaveLength(1);
      const tx = env.data[0]!;
      expect(tx.hash).toBe("YQ2UFOf2lJotfbBSwSw9NIQjP5pk9tn+Bp0cr8Nl324=");
      expect(tx.feeUgnot).toBe(1000000);
      expect(tx.messages[0]).toEqual({
        kind: "send",
        from: "g18qhq2fl54lszhmxeyqlvxnwjzc3xpu4nnakclp",
        to: "g1sd2hazs3wgxj0xm2v07dycg27r583vjehxaxhk",
        amount: "15000000ugnot",
      });
    });
  });

  it("decodes a real realm call with its arguments and memo", async () => {
    // Topaz block 462543 — a gnoswap Approve, sent through gnoswap.io.
    mockIndexerResponse(FIXTURES.call.response.data);
    const env = await blockTransactions(NETWORK, 462543, NOW);
    const tx = env.data[0]!;
    expect(tx.memo).toBe("Executed through gnoswap.io");
    expect(tx.messages[0]).toMatchObject({
      kind: "call",
      caller: "g1zzr0xsuh4msmz6e55q9tp3yq6fu63at54lr8qu",
      packagePath: "gno.land/r/gnoswap/common",
      func: "Approve",
      args: ["gno.land/r/gnoswap/gns.GNS", "g1em9s40nfrwd2aqn9ypjv7d9x9z9c8uk5uxrza9", "10000000000"],
    });
  });

  it("surfaces why a transaction failed, not just that it did", async () => {
    // Topaz block 427346. block_results only exposes that an error
    // happened; the reason is the whole point of looking.
    mockIndexerResponse(FIXTURES.failedCall.response.data);
    const env = await blockTransactions(NETWORK, 427346, NOW);
    expect(env.data[0]!.success).toBe(false);
    expect(env.data[0]!.error).toBe("unauthorized error");
  });

  it("decodes a real package deployment", async () => {
    // Topaz block 454237.
    mockIndexerResponse(FIXTURES.addPackage.response.data);
    const env = await blockTransactions(NETWORK, 454237, NOW);
    expect(env.data[0]!.messages[0]).toMatchObject({
      kind: "addpkg",
      creator: "g1j2adx6ngvawtmkhq7eexsk9uq4u9zsrealpye2",
      packagePath: "gno.land/r/g1j2adx6ngvawtmkhq7eexsk9uq4u9zsrealpye2/testtoken",
      packageName: "testtoken",
    });
  });

  it("marks the data as indexer-derived so the UI can say so", async () => {
    mockIndexerResponse(FIXTURES.bankSend.response.data);
    const env = await blockTransactions(NETWORK, 467231, NOW);
    expect(env.source).toBe("indexer");
    expect(env.consistency).toBe("indexed");
  });

  it("still lists a message type it has no fragment for", async () => {
    mockIndexerResponse({
      getTransactions: [
        {
          hash: "h", index: 0, success: true, gas_used: 1, gas_wanted: 2,
          gas_fee: { amount: 3 }, memo: "", response: { error: "" },
          messages: [{ route: "vm", typeUrl: "something_new", value: {} }],
        },
      ],
    });
    const env = await blockTransactions(NETWORK, 1, NOW);
    expect(env.data[0]!.messages[0]).toEqual({
      kind: "unknown",
      route: "vm",
      typeUrl: "something_new",
    });
  });

  it("refuses without an indexer rather than pretending there is no detail", async () => {
    await expect(blockTransactions({ id: "gnodev" }, 1, NOW)).rejects.toThrow(/no indexer/);
  });
});
