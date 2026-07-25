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
