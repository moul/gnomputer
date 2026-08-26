import { wrapEnvelope, type DataEnvelope } from "@gnomputer/core";
import { z } from "zod";
import { fetchWithDeadline } from "./fetch-with-deadline";

// As of 2026-07-25, Topaz's indexer (indexer.topaz.testnets.gno.land) sends
// `access-control-allow-origin: *` and these queries work directly from the
// browser — confirmed live via a real cross-origin browser fetch (not just
// curl) and via a live vitest run against the real endpoint. Previously
// (ADR-012/015) this was blocked entirely by a missing CORS header; that's
// no longer true — recorded as ADR-018 — though callers should still treat
// network failure as a possible, if now much rarer, "not available" state. The schema itself is
// narrower than a typical GraphQL API: only getBlocks/getTransactions/
// latestBlockHeight (getAccount-style queries don't exist — "what has this
// address done" only works by filtering getTransactions on a message's
// caller/creator field), no gte/lte or `in` filter operators, no pagination
// (cursor/take/skip) — only `where`+`order`, and a hard 10,000-row cap per
// query enforced server-side.

export interface RealmSummary {
  packagePath: string;
  blockHeight: number;
}

export interface IndexerEvent {
  height: number;
  txIndex: number;
  type: string;
  attrs: { key: string; value: string }[];
}

// Two schemas, not one, because the two queries that return add_package
// transactions select DIFFERENT fields: CountByCreator asks only for the
// messages, ListRealms also asks for block_height. Sharing one schema made
// the narrower query fail validation on a field it never requested — which
// is precisely the mismatch per-query schemas exist to catch, and it showed
// up the moment they were introduced.
const AddPackageMessagesSchema = z.object({
  messages: z.array(
    z.object({ value: z.object({ package: z.object({ path: z.string() }).nullish() }).nullable() })
  ),
});
const AddPackageTxSchema = AddPackageMessagesSchema.extend({ block_height: z.number() });

// nullish(), not optional(). GraphQL returns JSON null for an absent field
// rather than omitting the key, and optional() accepts undefined only —
// live Topaz really does send `attrs: null` on some events, which a
// fixture-only test would never have shown.
const GnoEventNodeSchema = z.object({
  type: z.string().nullish(),
  pkg_path: z.string().nullish(),
  attrs: z.array(z.object({ key: z.string(), value: z.string() })).nullish(),
});

const RealmHistoryTxSchema = z.object({
  block_height: z.number(),
  index: z.number(),
  response: z.object({ events: z.array(GnoEventNodeSchema.nullable()) }).nullable(),
});

export interface RealmGasStat {
  packagePath: string;
  gasUsed: number;
  txCount: number;
}

export interface TopGasTx {
  height: number;
  index: number;
  gasUsed: number;
  gasWanted: number;
  feeUgnot: number;
  packagePaths: string[];
}

export interface AddressActivityStat {
  address: string;
  count: number;
}

export interface ChainActivityStats {
  totalTxs: number;
  totalCalls: number;
  totalDeploys: number;
  totalRuns: number;
  totalSends: number;
  totalGasUsed: number;
  totalGasWanted: number;
  totalFeeUgnot: number;
  topRealmsByGas: RealmGasStat[];
  topTxsByGas: TopGasTx[];
  topCallers: AddressActivityStat[];
  topDeployers: AddressActivityStat[];
}

const ActivityMessageValueSchema = z.object({
  pkg_path: z.string().nullish(),
  caller: z.string().nullish(),
  creator: z.string().nullish(),
  package: z.object({ path: z.string() }).nullish(),
});

const ActivityTxSchema = z.object({
  block_height: z.number(),
  index: z.number(),
  gas_used: z.number(),
  gas_wanted: z.number(),
  gas_fee: z.object({ amount: z.number() }).nullable(),
  messages: z.array(
    z.object({ typeUrl: z.string(), value: ActivityMessageValueSchema.nullable() })
  ),
});

const LIST_REALMS_QUERY = `{
  getTransactions(where: { success: { eq: true }, messages: { typeUrl: { eq: "add_package" } } }) {
    block_height
    messages { value { ... on MsgAddPackage { package { path } } } }
  }
}`;

async function queryIndexer<T extends z.ZodTypeAny>(
  graphqlUrl: string,
  query: string,
  schema: T,
  variables?: Record<string, unknown>,
  timeoutMs?: number
): Promise<z.infer<T>> {
  const res = await fetchWithDeadline(
    graphqlUrl,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    },
    timeoutMs
  );
  if (!res.ok) {
    throw new Error(`Indexer request failed: ${res.status} ${res.statusText}`);
  }
  // Everything below treats the response as untrusted until proven
  // otherwise. Previously this did `return json.data as T` — a bare cast,
  // so a malformed or unexpected payload became a "valid" typed value and
  // failed later, somewhere unrelated, as a confusing TypeError (AUD-022).
  //
  // Two layers. First the GraphQL ENVELOPE: that the body is JSON, that
  // `errors` (when present) is really an array of messages, and that `data`
  // is an object. Then the caller's own schema over `data`, so a field that
  // changed type or went missing fails here, naming the endpoint and the
  // field, instead of becoming `undefined` and surfacing later as a
  // TypeError somewhere unrelated.
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new Error(`Indexer at ${new URL(graphqlUrl).host} returned a non-JSON response.`);
  }
  if (typeof json !== "object" || json === null) {
    throw new Error(`Indexer at ${new URL(graphqlUrl).host} returned an unexpected response.`);
  }

  const body = json as { errors?: unknown; data?: unknown };
  if (Array.isArray(body.errors) && body.errors.length > 0) {
    const first = body.errors[0] as { message?: unknown };
    throw new Error(typeof first?.message === "string" ? first.message : "Indexer query failed");
  }
  if (typeof body.data !== "object" || body.data === null) {
    throw new Error(
      `Indexer at ${new URL(graphqlUrl).host} returned no data for this query.`
    );
  }
  const parsed = schema.safeParse(body.data);
  if (!parsed.success) {
    // Name the field and what was wrong with it. "Unexpected response" sends
    // the next person to read the whole GraphQL schema; "getTransactions.0.
    // gas_used: expected number, received string" does not.
    const issue = parsed.error.issues[0];
    const path = issue?.path.join(".") ?? "(root)";
    throw new Error(
      `Indexer at ${new URL(graphqlUrl).host} returned an unexpected shape at ${path}: ${issue?.message ?? "validation failed"}`
    );
  }
  return parsed.data;
}

// `creator` is a real filter field on MsgAddPackage, confirmed via
// introspection and a live query returning a known address's actual
// deployed packages. (An earlier version of this comment said the call was
// CORS-blocked; that stopped being true in 2026-07 — see ADR-018 and the
// note at the top of this file.)
const COUNT_BY_CREATOR_QUERY = `
  query CountByCreator($address: String!) {
    getTransactions(where: { success: { eq: true }, messages: { typeUrl: { eq: "add_package" }, value: { MsgAddPackage: { creator: { eq: $address } } } } }) {
      messages { value { ... on MsgAddPackage { package { path } } } }
    }
  }
`;

export async function countPackagesByCreator(
  network: { id: string; indexerGraphqlUrl?: string },
  address: string,
  fetchedAt: string
): Promise<DataEnvelope<{ count: number }>> {
  if (!network.indexerGraphqlUrl) {
    throw new Error(`${network.id} has no indexer configured — package discovery needs one.`);
  }

  const data = await queryIndexer(
    network.indexerGraphqlUrl,
    COUNT_BY_CREATOR_QUERY,
    z.object({ getTransactions: z.array(AddPackageMessagesSchema).nullable() }),
    { address }
  );
  const paths = new Set<string>();
  // The indexer returns `getTransactions: null` (not `[]`) when nothing
  // matches — confirmed live for an address with zero deployments, which is
  // the common case (most addresses never deploy a package).
  for (const tx of data.getTransactions ?? []) {
    for (const message of tx.messages) {
      const path = message.value?.package?.path;
      if (path) paths.add(path);
    }
  }

  return wrapEnvelope({
    ref: {
      uri: `gno://${network.id}/address/${address}`,
      kind: "address",
      objectId: address,
      networkId: network.id,
    },
    data: { count: paths.size },
    source: "indexer",
    consistency: "indexed",
    networkId: network.id,
    fetchedAt,
    freshness: "live",
    schema: "gnomputer.indexer.package-count.v1",
  });
}

export async function listRealms(
  network: { id: string; indexerGraphqlUrl?: string },
  fetchedAt: string,
  limit = 100
): Promise<DataEnvelope<RealmSummary[]>> {
  if (!network.indexerGraphqlUrl) {
    throw new Error(`${network.id} has no indexer configured — realm discovery needs one.`);
  }

  const data = await queryIndexer(
    network.indexerGraphqlUrl,
    LIST_REALMS_QUERY,
    z.object({ getTransactions: z.array(AddPackageTxSchema).nullable() })
  );

  const latestHeightByPath = new Map<string, number>();
  for (const tx of data.getTransactions ?? []) {
    for (const message of tx.messages) {
      const path = message.value?.package?.path;
      if (!path || !path.includes("/r/")) continue;
      const existing = latestHeightByPath.get(path);
      if (existing === undefined || tx.block_height > existing) {
        latestHeightByPath.set(path, tx.block_height);
      }
    }
  }

  const realms = [...latestHeightByPath.entries()]
    .map(([packagePath, blockHeight]) => ({ packagePath, blockHeight }))
    .sort((a, b) => b.blockHeight - a.blockHeight)
    .slice(0, limit);

  return wrapEnvelope({
    ref: { uri: `gno://${network.id}/network/${network.id}`, kind: "network", networkId: network.id },
    data: realms,
    source: "indexer",
    consistency: "indexed",
    networkId: network.id,
    fetchedAt,
    freshness: "live",
    schema: "gnomputer.indexer.realm-list.v1",
  });
}

// `pkg_path` is a real filter field on MsgCall (same confirmed-live pattern
// as MsgAddPackage.creator above). Events come back per-transaction via
// `response.events` regardless of which package they belong to (a single
// call can touch several realms' events in one tx, e.g. a token transfer
// nested inside a swap call) — filtered client-side to just this
// packagePath's own GnoEvents. Non-GnoEvent union members (storage
// deposit/unlock, unknown) come back as `{}` since only `... on GnoEvent`
// is requested, so `!ev?.type` also filters those out.
const REALM_HISTORY_QUERY = `
  query RealmHistory($pkgPath: String!) {
    getTransactions(where: { success: { eq: true }, messages: { value: { MsgCall: { pkg_path: { eq: $pkgPath } } } } }, order: { heightAndIndex: DESC }) {
      block_height
      index
      response { events { ... on GnoEvent { type pkg_path attrs { key value } } } }
    }
  }
`;

export interface IndexerRecentEvent extends IndexerEvent {
  pkgPath: string;
}

// Same query shape as REALM_HISTORY_QUERY above but with no pkg_path
// filter — every successful transaction's own GnoEvents, most recent first.
// Used to backfill the Event Explorer (chain-wide, no single realm) so it
// shows real recent activity immediately instead of waiting for the next
// live block to happen to carry an event.
const RECENT_EVENTS_QUERY = `
  query RecentEvents {
    getTransactions(where: { success: { eq: true } }, order: { heightAndIndex: DESC }) {
      block_height
      index
      response { events { ... on GnoEvent { type pkg_path attrs { key value } } } }
    }
  }
`;

export async function recentEvents(
  network: { id: string; indexerGraphqlUrl?: string },
  fetchedAt: string,
  limit = 40
): Promise<DataEnvelope<IndexerRecentEvent[]>> {
  if (!network.indexerGraphqlUrl) {
    throw new Error(`${network.id} has no indexer configured — event history needs one.`);
  }

  const data = await queryIndexer(
    network.indexerGraphqlUrl,
    RECENT_EVENTS_QUERY,
    z.object({ getTransactions: z.array(RealmHistoryTxSchema).nullable() })
  );

  const events: IndexerRecentEvent[] = [];
  outer: for (const tx of data.getTransactions ?? []) {
    for (const ev of tx.response?.events ?? []) {
      if (!ev?.type || !ev.pkg_path) continue;
      events.push({
        height: tx.block_height,
        txIndex: tx.index,
        type: ev.type,
        pkgPath: ev.pkg_path,
        attrs: ev.attrs ?? [],
      });
      if (events.length >= limit) break outer;
    }
  }

  return wrapEnvelope({
    ref: { uri: `gno://${network.id}/network/${network.id}`, kind: "network", networkId: network.id },
    data: events,
    source: "indexer",
    consistency: "indexed",
    networkId: network.id,
    fetchedAt,
    freshness: "live",
    schema: "gnomputer.indexer.recent-events.v1",
  });
}

export async function realmHistory(
  network: { id: string; indexerGraphqlUrl?: string },
  packagePath: string,
  fetchedAt: string,
  limit = 100
): Promise<DataEnvelope<IndexerEvent[]>> {
  if (!network.indexerGraphqlUrl) {
    throw new Error(`${network.id} has no indexer configured — realm history needs one.`);
  }

  const data = await queryIndexer(
    network.indexerGraphqlUrl,
    REALM_HISTORY_QUERY,
    z.object({ getTransactions: z.array(RealmHistoryTxSchema).nullable() }),
    { pkgPath: packagePath }
  );

  const events: IndexerEvent[] = [];
  outer: for (const tx of data.getTransactions ?? []) {
    for (const ev of tx.response?.events ?? []) {
      if (!ev?.type || ev.pkg_path !== packagePath) continue;
      events.push({ height: tx.block_height, txIndex: tx.index, type: ev.type, attrs: ev.attrs ?? [] });
      if (events.length >= limit) break outer;
    }
  }

  return wrapEnvelope({
    ref: {
      uri: `gno://${network.id}/realm/${packagePath}`,
      kind: "realm",
      objectId: packagePath,
      networkId: network.id,
    },
    data: events,
    source: "indexer",
    consistency: "indexed",
    networkId: network.id,
    fetchedAt,
    freshness: "live",
    schema: "gnomputer.indexer.realm-history.v1",
  });
}

// No `where` filter here (beyond success) and no pagination exists on this
// schema at all — the whole chain's successful-transaction history comes
// back in one request, capped at 10,000 rows server-side. Confirmed live
// this comfortably covers Topaz's real current volume (842 txs, ~213KB,
// well under a second) — mygnoscan's own /api/gas and /api/analytics pages
// are backed by the same total-volume assumption (they aggregate ALL
// transactions server-side, not a windowed sample), so this matches that
// convention rather than inventing a new one.
//
// A transaction's gas is attributed to EVERY distinct realm its messages
// reference (not just the first) — a multi-message tx (e.g. one swap
// touching three gnoswap realms) counts its full gas toward each one. This
// double-counts gas across realms in a single tx, which is the same
// tradeoff mygnoscan's own per-realm gas tally makes (confirmed via its
// per-realm storage/gas tab attributing a shared tx to multiple realms).
/** Blocks of history the leaderboard is built from. Measured at 1,961
 * transactions on Sapphire — comfortably under the indexer's ten-thousand
 * element cap, which an unbounded scan hit every time. */
const CHAIN_ACTIVITY_BLOCK_WINDOW = 2_000;

const CHAIN_ACTIVITY_QUERY = `query ChainActivity($fromHeight: Int!) {
  getTransactions(
    where: { success: { eq: true }, block_height: { gt: $fromHeight } }
    order: { heightAndIndex: DESC }
  ) {
    block_height
    index
    gas_used
    gas_wanted
    gas_fee { amount }
    messages {
      typeUrl
      value {
        ... on MsgCall { pkg_path caller }
        ... on MsgAddPackage { creator package { path } }
        ... on MsgRun { caller }
      }
    }
  }
}`;

const TOP_N = 20;

export async function chainActivityStats(
  network: { id: string; indexerGraphqlUrl?: string },
  fetchedAt: string
): Promise<DataEnvelope<ChainActivityStats>> {
  if (!network.indexerGraphqlUrl) {
    throw new Error(`${network.id} has no indexer configured — chain activity stats need one.`);
  }

  const { latestBlockHeight } = await queryIndexer(
    network.indexerGraphqlUrl,
    LATEST_HEIGHT_QUERY,
    z.object({ latestBlockHeight: z.number() })
  );

  const data = await queryIndexer(
    network.indexerGraphqlUrl,
    CHAIN_ACTIVITY_QUERY,
    z.object({ getTransactions: z.array(ActivityTxSchema).nullable() }),
    { fromHeight: Math.max(0, latestBlockHeight - CHAIN_ACTIVITY_BLOCK_WINDOW) }
  );
  const txs = data.getTransactions ?? [];

  let totalCalls = 0;
  let totalDeploys = 0;
  let totalRuns = 0;
  let totalSends = 0;
  let totalGasUsed = 0;
  let totalGasWanted = 0;
  let totalFeeUgnot = 0;
  const gasByRealm = new Map<string, { gasUsed: number; txCount: number }>();
  const callsByAddress = new Map<string, number>();
  const deploysByAddress = new Map<string, number>();
  const topTxsByGas: TopGasTx[] = [];

  for (const tx of txs) {
    totalGasUsed += tx.gas_used;
    totalGasWanted += tx.gas_wanted;
    totalFeeUgnot += tx.gas_fee?.amount ?? 0;

    const packagePaths = new Set<string>();
    for (const message of tx.messages) {
      if (message.typeUrl === "exec") {
        totalCalls++;
        if (message.value?.pkg_path) packagePaths.add(message.value.pkg_path);
        if (message.value?.caller) {
          callsByAddress.set(message.value.caller, (callsByAddress.get(message.value.caller) ?? 0) + 1);
        }
      } else if (message.typeUrl === "add_package") {
        totalDeploys++;
        if (message.value?.package?.path) packagePaths.add(message.value.package.path);
        if (message.value?.creator) {
          deploysByAddress.set(message.value.creator, (deploysByAddress.get(message.value.creator) ?? 0) + 1);
        }
      } else if (message.typeUrl === "run") {
        totalRuns++;
      } else if (message.typeUrl === "send") {
        totalSends++;
      }
    }

    for (const path of packagePaths) {
      const existing = gasByRealm.get(path) ?? { gasUsed: 0, txCount: 0 };
      existing.gasUsed += tx.gas_used;
      existing.txCount += 1;
      gasByRealm.set(path, existing);
    }

    topTxsByGas.push({
      height: tx.block_height,
      index: tx.index,
      gasUsed: tx.gas_used,
      gasWanted: tx.gas_wanted,
      feeUgnot: tx.gas_fee?.amount ?? 0,
      packagePaths: [...packagePaths],
    });
  }

  const stats: ChainActivityStats = {
    totalTxs: txs.length,
    totalCalls,
    totalDeploys,
    totalRuns,
    totalSends,
    totalGasUsed,
    totalGasWanted,
    totalFeeUgnot,
    topRealmsByGas: [...gasByRealm.entries()]
      .map(([packagePath, stat]) => ({ packagePath, ...stat }))
      .sort((a, b) => b.gasUsed - a.gasUsed)
      .slice(0, TOP_N),
    topTxsByGas: topTxsByGas.sort((a, b) => b.gasUsed - a.gasUsed).slice(0, TOP_N),
    topCallers: [...callsByAddress.entries()]
      .map(([address, count]) => ({ address, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, TOP_N),
    topDeployers: [...deploysByAddress.entries()]
      .map(([address, count]) => ({ address, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, TOP_N),
  };

  return wrapEnvelope({
    ref: { uri: `gno://${network.id}/network/${network.id}`, kind: "network", networkId: network.id },
    data: stats,
    source: "indexer",
    consistency: "indexed",
    networkId: network.id,
    fetchedAt,
    freshness: "live",
    schema: "gnomputer.indexer.chain-activity-stats.v1",
  });
}

export interface DailyActivity {
  /** UTC calendar date, "YYYY-MM-DD". */
  date: string;
  blockCount: number;
  txCount: number;
}

const DailyActivityBlockSchema = z.object({ time: z.string(), num_txs: z.number() });

// Neither Gnomputer nor mygnoscan has a time-series chart at all (confirmed
// live: mygnoscan's own client has zero chart/canvas/sparkline code, and
// its "Analytics"/"Gas" pages are cumulative leaderboards, not
// time-series) — this is genuinely ahead, not just parity.
//
// `num_txs: { gt: 0 }` cuts the row count from "every block ever" (most
// blocks are empty, and the unfiltered count blows the 10,000-row cap
// immediately) down to just the ones worth bucketing.
//
// The height floor is the other half, and it is what makes this query work
// at all. The indexer scans the whole height range server-side, so cost
// tracks the RANGE, not the rows returned — and unbounded, that range grows
// with the chain. Measured against Topaz on 2026-08-02:
//
//   unbounded          58.5s   1897 blocks   (past the 15s deadline: the
//                                             chart simply never rendered)
//   last 100k blocks   29.8s    434 blocks   ~5 days
//   last  50k blocks   15.5s    197 blocks   ~2 days
//   last  20k blocks    6.2s     99 blocks   ~1 day
//
// So there is no window that is both useful and fast. ~20k blocks is a day,
// which is one or two bars on a daily chart. The choice made here is a
// 5-day window with a deadline long enough to actually reach it, cached
// hard — a slow chart that appears beats a fast one that does not (#138).
const DAILY_ACTIVITY_BLOCK_WINDOW = 100_000;
const DAILY_ACTIVITY_TIMEOUT_MS = 60_000;

const LATEST_HEIGHT_QUERY = `{ latestBlockHeight }`;

const DAILY_ACTIVITY_QUERY = `
  query DailyActivity($fromHeight: Int!) {
    getBlocks(
      where: { height: { gt: $fromHeight }, num_txs: { gt: 0 } }
      order: { height: ASC }
    ) {
      time
      num_txs
    }
  }
`;

export async function dailyActivity(
  network: { id: string; indexerGraphqlUrl?: string },
  fetchedAt: string
): Promise<DataEnvelope<DailyActivity[]>> {
  if (!network.indexerGraphqlUrl) {
    throw new Error(`${network.id} has no indexer configured — daily activity needs one.`);
  }

  // Cheap (measured 0.3s) and the only way to know where the window starts.
  const { latestBlockHeight } = await queryIndexer(
    network.indexerGraphqlUrl,
    LATEST_HEIGHT_QUERY,
    z.object({ latestBlockHeight: z.number() })
  );

  const data = await queryIndexer(
    network.indexerGraphqlUrl,
    DAILY_ACTIVITY_QUERY,
    z.object({ getBlocks: z.array(DailyActivityBlockSchema).nullable() }),
    { fromHeight: Math.max(0, latestBlockHeight - DAILY_ACTIVITY_BLOCK_WINDOW) },
    DAILY_ACTIVITY_TIMEOUT_MS
  );

  const byDate = new Map<string, { blockCount: number; txCount: number }>();
  for (const block of data.getBlocks ?? []) {
    const date = block.time.slice(0, 10);
    const existing = byDate.get(date) ?? { blockCount: 0, txCount: 0 };
    existing.blockCount += 1;
    existing.txCount += block.num_txs;
    byDate.set(date, existing);
  }

  const days = [...byDate.entries()]
    .map(([date, stat]) => ({ date, ...stat }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return wrapEnvelope({
    ref: { uri: `gno://${network.id}/network/${network.id}`, kind: "network", networkId: network.id },
    data: days,
    source: "indexer",
    consistency: "indexed",
    networkId: network.id,
    fetchedAt,
    freshness: "live",
    schema: "gnomputer.indexer.daily-activity.v1",
  });
}

export interface IndexerTransaction {
  height: number;
  txIndex: number;
  success: boolean;
  gasUsed: number;
  gasWanted: number;
  feeUgnot: number;
  packagePaths: string[];
  eventCount: number;
}

const ListTransactionsMessageValueSchema = z.object({
  pkg_path: z.string().nullish(),
  package: z.object({ path: z.string() }).nullish(),
});

const ListTransactionsTxSchema = z.object({
  block_height: z.number(),
  index: z.number(),
  success: z.boolean(),
  gas_used: z.number(),
  gas_wanted: z.number(),
  gas_fee: z.object({ amount: z.number() }).nullable(),
  messages: z.array(z.object({ value: ListTransactionsMessageValueSchema.nullable() })),
  response: z.object({ events: z.array(z.unknown()) }).nullable(),
});

// `where: {}` (no filter at all beyond the required argument itself) is
// valid and returns BOTH successful and failed transactions — confirmed
// live (863 real transactions on Topaz, including both) — unlike every
// other query in this file, which filters by success/pkg_path/etc.
/**
 * Recent transactions, newest first, bounded by block height.
 *
 * `where: {}` asked for every transaction the chain had ever produced. The
 * indexer answers that with `max elements per query reached (10000)` in
 * `errors` *and* ten thousand rows in `data` — and since an `errors` array is
 * a failed query here, the Transactions app sat on "Loading transaction
 * history…" forever on any chain past its first ten thousand transactions.
 * Sapphire crossed that long ago.
 *
 * There is no `first`/`limit` argument on this field (confirmed by
 * introspection: `where` and `order` are the only two), so the bound has to be
 * a height window — the same shape dailyActivity already uses.
 */
/** Block windows to try, narrowest first. 2,000 blocks was measured at 1,961
 * transactions on Sapphire — comfortably under the cap — and the last entry is
 * wide enough to reach back through a quiet chain's history. */
const LIST_TRANSACTIONS_WINDOWS = [2_000, 20_000, 200_000];

const LIST_TRANSACTIONS_QUERY = `query ListTransactions($fromHeight: Int!) {
  getTransactions(where: { block_height: { gt: $fromHeight } }, order: { heightAndIndex: DESC }) {
    block_height
    index
    success
    gas_used
    gas_wanted
    gas_fee { amount }
    messages {
      value {
        ... on MsgCall { pkg_path }
        ... on MsgAddPackage { package { path } }
      }
    }
    response { events { ... on GnoEvent { type } } }
  }
}`;

export async function listTransactions(
  network: { id: string; indexerGraphqlUrl?: string },
  fetchedAt: string,
  limit = 200
): Promise<DataEnvelope<IndexerTransaction[]>> {
  if (!network.indexerGraphqlUrl) {
    throw new Error(`${network.id} has no indexer configured — transaction history needs one.`);
  }

  // Cheap (measured 0.3s) and the only way to know where the window starts.
  const { latestBlockHeight } = await queryIndexer(
    network.indexerGraphqlUrl,
    LATEST_HEIGHT_QUERY,
    z.object({ latestBlockHeight: z.number() })
  );

  // Transaction density is a property of the chain, not something we can know
  // ahead of time: the same window that returns two thousand rows on a busy
  // testnet returns none on a quiet one. Start narrow enough to stay well
  // under the indexer's ten-thousand cap, and widen only if there was not
  // enough to fill the list.
  let rows: z.infer<typeof ListTransactionsTxSchema>[] = [];
  for (const window of LIST_TRANSACTIONS_WINDOWS) {
    const data = await queryIndexer(
      network.indexerGraphqlUrl,
      LIST_TRANSACTIONS_QUERY,
      z.object({ getTransactions: z.array(ListTransactionsTxSchema).nullable() }),
      { fromHeight: Math.max(0, latestBlockHeight - window) }
    );
    rows = data.getTransactions ?? [];
    if (rows.length >= limit || window >= latestBlockHeight) break;
  }

  const transactions: IndexerTransaction[] = rows.slice(0, limit).map((tx) => {
    const packagePaths = new Set<string>();
    for (const message of tx.messages) {
      const path = message.value?.pkg_path ?? message.value?.package?.path;
      if (path) packagePaths.add(path);
    }
    return {
      height: tx.block_height,
      txIndex: tx.index,
      success: tx.success,
      gasUsed: tx.gas_used,
      gasWanted: tx.gas_wanted,
      feeUgnot: tx.gas_fee?.amount ?? 0,
      packagePaths: [...packagePaths],
      eventCount: tx.response?.events.length ?? 0,
    };
  });

  return wrapEnvelope({
    ref: { uri: `gno://${network.id}/network/${network.id}`, kind: "network", networkId: network.id },
    data: transactions,
    source: "indexer",
    consistency: "indexed",
    networkId: network.id,
    fetchedAt,
    freshness: "live",
    schema: "gnomputer.indexer.transaction-list.v1",
  });
}

// Only block_height, and nothing else. The full transaction query this
// mirrors returns about 1MB on Topaz; asking for heights alone returns
// 54KB, and "which recent blocks contain transactions" needs no more than
// that. Measured live 2026-08-03.
//
// There is no `first`/`limit` argument to lean on — the tx-indexer rejects
// both (ADR-016: the schema is narrower than it looks) — so the cap is
// applied here, after the response arrives.
const BLOCK_HEIGHTS_WITH_TXS_QUERY = `{
  getTransactions(where: {}, order: { heightAndIndex: DESC }) {
    block_height
  }
}`;

const BlockHeightSchema = z.object({ block_height: z.number() });

/** Heights of the most recent blocks that actually contain transactions,
 * newest first and de-duplicated.
 *
 * The Block Explorer's "Only with txs" filter cannot be answered from the
 * live window on a quiet chain: measured on Topaz, none of the last 40
 * blocks had a transaction and the most recent one that did was 554 blocks
 * behind the tip. Filtering a 12-block feed therefore returned nothing
 * every time, and scanning backwards over RPC would be hundreds of calls
 * to find one block.
 *
 * Needs an indexer. Networks without one (gnodev) can only search what the
 * live feed has seen, and the caller says so rather than pretending. */
export async function listBlockHeightsWithTxs(
  network: { id: string; indexerGraphqlUrl?: string },
  fetchedAt: string,
  limit = 12
): Promise<DataEnvelope<number[]>> {
  if (!network.indexerGraphqlUrl) {
    throw new Error(`${network.id} has no indexer configured — searching block history needs one.`);
  }

  const data = await queryIndexer(
    network.indexerGraphqlUrl,
    BLOCK_HEIGHTS_WITH_TXS_QUERY,
    z.object({ getTransactions: z.array(BlockHeightSchema).nullable() })
  );

  // De-duplicated before the cap, not after: several transactions in one
  // block are one block, and slicing first would return fewer blocks than
  // asked for whenever a busy block appeared.
  const heights: number[] = [];
  for (const row of data.getTransactions ?? []) {
    if (heights.length >= limit) break;
    if (!heights.includes(row.block_height)) heights.push(row.block_height);
  }

  return wrapEnvelope({
    ref: { uri: `gno://${network.id}/network/${network.id}`, kind: "network", networkId: network.id },
    data: heights,
    source: "indexer",
    consistency: "indexed",
    networkId: network.id,
    fetchedAt,
    freshness: "live",
    schema: "gnomputer.indexer.block-heights-with-txs.v1",
  });
}

/** One message inside a transaction, in the terms the chain actually
 * records it — not a flattened summary.
 *
 * Discriminated on `kind` rather than the indexer's `__typename` so the
 * app never has to know GraphQL naming. Every variant carries who signed
 * it, because "who did this" is the first thing anyone asks of a
 * transaction and the RPC block_results path cannot answer it at all. */
export type IndexerMessage =
  | { kind: "send"; from: string; to: string; amount: string }
  | { kind: "call"; caller: string; packagePath: string; func: string; args: string[]; send: string }
  | { kind: "addpkg"; creator: string; packagePath: string; packageName: string; deposit: string }
  | { kind: "run"; caller: string; send: string }
  | { kind: "unknown"; route: string; typeUrl: string };

export interface IndexerBlockTx {
  hash: string;
  txIndex: number;
  success: boolean;
  gasUsed: number;
  gasWanted: number;
  feeUgnot: number;
  memo: string;
  messages: IndexerMessage[];
  /** The node's own reason a transaction failed, empty when it succeeded.
   * block_results only exposes that an error happened, not what it was. */
  error: string;
}

// Every field here was confirmed live against Topaz's indexer before being
// asked for — the schema is narrower than a typical GraphQL API (see the
// note at the top of this file), so a plausible-looking field is not
// evidence it exists.
const BLOCK_TRANSACTIONS_QUERY = `query BlockTransactions($height: Int!) {
  getTransactions(where: { block_height: { eq: $height } }, order: { heightAndIndex: ASC }) {
    hash
    index
    success
    gas_used
    gas_wanted
    gas_fee { amount }
    memo
    messages {
      route
      typeUrl
      value {
        ... on BankMsgSend { from_address to_address amount }
        ... on MsgCall { caller send pkg_path func args }
        ... on MsgAddPackage { creator deposit package { name path } }
        ... on MsgRun { caller send }
      }
    }
    response { error }
  }
}`;

const BlockTxMessageSchema = z.object({
  route: z.string().nullish(),
  typeUrl: z.string().nullish(),
  value: z
    .object({
      from_address: z.string().nullish(),
      to_address: z.string().nullish(),
      amount: z.string().nullish(),
      caller: z.string().nullish(),
      send: z.string().nullish(),
      pkg_path: z.string().nullish(),
      func: z.string().nullish(),
      args: z.array(z.string()).nullish(),
      creator: z.string().nullish(),
      deposit: z.string().nullish(),
      package: z.object({ name: z.string().nullish(), path: z.string().nullish() }).nullish(),
    })
    .nullable(),
});

const BlockTxSchema = z.object({
  hash: z.string().nullish(),
  index: z.number(),
  success: z.boolean(),
  gas_used: z.number(),
  gas_wanted: z.number(),
  gas_fee: z.object({ amount: z.number() }).nullable(),
  memo: z.string().nullish(),
  messages: z.array(BlockTxMessageSchema),
  response: z.object({ error: z.string().nullish() }).nullable(),
});

/** The union is resolved by which fields came back, not by `__typename`:
 * the inline fragments above mean exactly one variant's fields are
 * populated, and asking for `__typename` too would be a second thing that
 * could disagree with the first. */
function toMessage(raw: z.infer<typeof BlockTxMessageSchema>): IndexerMessage {
  const v = raw.value;
  if (v) {
    if (v.from_address) {
      return { kind: "send", from: v.from_address, to: v.to_address ?? "", amount: v.amount ?? "" };
    }
    if (v.pkg_path) {
      return {
        kind: "call",
        caller: v.caller ?? "",
        packagePath: v.pkg_path,
        func: v.func ?? "",
        args: v.args ?? [],
        send: v.send ?? "",
      };
    }
    if (v.creator) {
      return {
        kind: "addpkg",
        creator: v.creator,
        packagePath: v.package?.path ?? "",
        packageName: v.package?.name ?? "",
        deposit: v.deposit ?? "",
      };
    }
    if (v.caller) {
      return { kind: "run", caller: v.caller, send: v.send ?? "" };
    }
  }
  // A message type this build has no fragment for still gets a row saying
  // what it was, rather than an empty gap in the list.
  return { kind: "unknown", route: raw.route ?? "?", typeUrl: raw.typeUrl ?? "?" };
}

/** What a block's transactions actually did — who signed them, what they
 * called, how much moved, and why any of them failed.
 *
 * The RPC `block_results` path (client.ts getBlockEvents) is the
 * authoritative source for gas and emitted events and works on every
 * network, but it carries no message bodies at all: it cannot say that a
 * transaction was a 15 GNOT transfer between two accounts, only that it
 * used some gas and emitted no events. That detail lives in the indexer,
 * so this is additive — the caller keeps showing the RPC row and enriches
 * it where an indexer exists. */
export async function blockTransactions(
  network: { id: string; indexerGraphqlUrl?: string },
  height: number,
  fetchedAt: string
): Promise<DataEnvelope<IndexerBlockTx[]>> {
  if (!network.indexerGraphqlUrl) {
    throw new Error(`${network.id} has no indexer configured — transaction detail needs one.`);
  }

  const data = await queryIndexer(
    network.indexerGraphqlUrl,
    BLOCK_TRANSACTIONS_QUERY,
    z.object({ getTransactions: z.array(BlockTxSchema).nullable() }),
    { height }
  );

  const txs: IndexerBlockTx[] = (data.getTransactions ?? []).map((tx) => ({
    hash: tx.hash ?? "",
    txIndex: tx.index,
    success: tx.success,
    gasUsed: tx.gas_used,
    gasWanted: tx.gas_wanted,
    feeUgnot: tx.gas_fee?.amount ?? 0,
    memo: tx.memo ?? "",
    messages: tx.messages.map(toMessage),
    error: tx.response?.error ?? "",
  }));

  return wrapEnvelope({
    ref: { ...{ uri: `gno://${network.id}/block/${height}`, kind: "block" as const, networkId: network.id }, objectId: String(height) },
    data: txs,
    source: "indexer",
    consistency: "indexed",
    networkId: network.id,
    height,
    fetchedAt,
    freshness: "live",
    schema: "gnomputer.indexer.block-transactions.v1",
  });
}
