import { wrapEnvelope, type DataEnvelope } from "@gnomputer/core";

// As of 2026-07-25, Topaz's indexer (indexer.topaz.testnets.gno.land) sends
// `access-control-allow-origin: *` and these queries work directly from the
// browser — confirmed live via a real cross-origin browser fetch (not just
// curl) and via a live vitest run against the real endpoint. Previously
// (ADR-012/015) this was blocked entirely by a missing CORS header; that's
// no longer true, though callers should still treat network failure as a
// possible, if now much rarer, "not available" state. The schema itself is
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

interface AddPackageTx {
  block_height: number;
  messages: { value: { package?: { path: string } } | null }[];
}

interface GnoEventNode {
  type?: string;
  pkg_path?: string;
  attrs?: { key: string; value: string }[];
}

interface RealmHistoryTx {
  block_height: number;
  index: number;
  response: { events: (GnoEventNode | null)[] } | null;
}

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

interface ActivityMessageValue {
  pkg_path?: string;
  caller?: string;
  creator?: string;
  package?: { path: string };
}

interface ActivityTx {
  block_height: number;
  index: number;
  gas_used: number;
  gas_wanted: number;
  gas_fee: { amount: number } | null;
  messages: { typeUrl: string; value: ActivityMessageValue | null }[];
}

const LIST_REALMS_QUERY = `{
  getTransactions(where: { success: { eq: true }, messages: { typeUrl: { eq: "add_package" } } }) {
    block_height
    messages { value { ... on MsgAddPackage { package { path } } } }
  }
}`;

async function queryIndexer<T>(
  graphqlUrl: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(graphqlUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    throw new Error(`Indexer request failed: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(json.errors[0].message ?? "Indexer query failed");
  }
  return json.data as T;
}

// `creator` is a real filter field on MsgAddPackage (confirmed via
// introspection and a live query returning a known address's actual
// deployed packages) — blocked by the same missing-CORS-header issue as
// every other indexer call, not by the query itself being wrong.
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

  const data = await queryIndexer<{ getTransactions: AddPackageTx[] | null }>(
    network.indexerGraphqlUrl,
    COUNT_BY_CREATOR_QUERY,
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

  const data = await queryIndexer<{ getTransactions: AddPackageTx[] | null }>(
    network.indexerGraphqlUrl,
    LIST_REALMS_QUERY
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

export async function realmHistory(
  network: { id: string; indexerGraphqlUrl?: string },
  packagePath: string,
  fetchedAt: string,
  limit = 100
): Promise<DataEnvelope<IndexerEvent[]>> {
  if (!network.indexerGraphqlUrl) {
    throw new Error(`${network.id} has no indexer configured — realm history needs one.`);
  }

  const data = await queryIndexer<{ getTransactions: RealmHistoryTx[] | null }>(
    network.indexerGraphqlUrl,
    REALM_HISTORY_QUERY,
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
const CHAIN_ACTIVITY_QUERY = `{
  getTransactions(where: { success: { eq: true } }, order: { heightAndIndex: DESC }) {
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

  const data = await queryIndexer<{ getTransactions: ActivityTx[] | null }>(
    network.indexerGraphqlUrl,
    CHAIN_ACTIVITY_QUERY
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

interface DailyActivityBlock {
  time: string;
  num_txs: number;
}

// Neither Gnomputer nor mygnoscan has a time-series chart at all (confirmed
// live: mygnoscan's own client has zero chart/canvas/sparkline code, and
// its "Analytics"/"Gas" pages are cumulative leaderboards, not
// time-series) — this is genuinely ahead, not just parity.
//
// `num_txs: { gt: 0 }` cuts the row count from "every block ever" (which
// blows the 10,000-row cap almost immediately — most blocks are empty) down
// to just the ones worth bucketing, confirmed live to bring back a full
// week of Topaz history (845 blocks) in one request. Still a real, several-
// second round trip (confirmed live: ~10s) since the indexer has to scan
// the full block range server-side to find them — worth caching
// aggressively client-side (a long staleTime) rather than refetching often.
const DAILY_ACTIVITY_QUERY = `{
  getBlocks(where: { height: { gt: 0 }, num_txs: { gt: 0 } }, order: { height: ASC }) {
    time
    num_txs
  }
}`;

export async function dailyActivity(
  network: { id: string; indexerGraphqlUrl?: string },
  fetchedAt: string
): Promise<DataEnvelope<DailyActivity[]>> {
  if (!network.indexerGraphqlUrl) {
    throw new Error(`${network.id} has no indexer configured — daily activity needs one.`);
  }

  const data = await queryIndexer<{ getBlocks: DailyActivityBlock[] | null }>(
    network.indexerGraphqlUrl,
    DAILY_ACTIVITY_QUERY
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
