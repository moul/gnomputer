import { wrapEnvelope, type DataEnvelope } from "@gnomputer/core";

// NOTE: as of this writing, Topaz's indexer (indexer.topaz.testnets.gno.land)
// sends no Access-Control-Allow-Origin header, so its CORS preflight fails
// and every one of these queries is rejected by the browser before it ever
// reaches the network — confirmed live, not just via server-side curl. Callers
// must treat rejection as an expected, user-facing "not available" state
// rather than a bug to chase, until the indexer adds CORS support.

export interface RealmSummary {
  packagePath: string;
  blockHeight: number;
}

interface AddPackageTx {
  block_height: number;
  messages: { value: { package?: { path: string } } | null }[];
}

const LIST_REALMS_QUERY = `{
  getTransactions(where: { success: { eq: true }, messages: { typeUrl: { eq: "add_package" } } }) {
    block_height
    messages { value { ... on MsgAddPackage { package { path } } } }
  }
}`;

async function queryIndexer<T>(graphqlUrl: string, query: string): Promise<T> {
  const res = await fetch(graphqlUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
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

export async function listRealms(
  network: { id: string; indexerGraphqlUrl?: string },
  fetchedAt: string,
  limit = 100
): Promise<DataEnvelope<RealmSummary[]>> {
  if (!network.indexerGraphqlUrl) {
    throw new Error(`${network.id} has no indexer configured — realm discovery needs one.`);
  }

  const data = await queryIndexer<{ getTransactions: AddPackageTx[] }>(
    network.indexerGraphqlUrl,
    LIST_REALMS_QUERY
  );

  const latestHeightByPath = new Map<string, number>();
  for (const tx of data.getTransactions) {
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
