import type { Tm2Client } from "@gnolang/tm2-rpc";
import type { NetworkConfig } from "@gnomputer/networks";
import { wrapEnvelope, type DataEnvelope } from "@gnomputer/core";
import { connectTm2Client, abciQueryString } from "./queries";

export interface BlockSummary {
  height: number;
  time: string;
  numTxs: number;
}

export interface RpcClient {
  getStatus(): Promise<DataEnvelope<{ latestHeight: number; chainId: string }>>;
  queryRender(packagePath: string, path: string, fetchedAt: string): Promise<DataEnvelope<string>>;
  queryFile(path: string, fetchedAt: string): Promise<DataEnvelope<string>>;
  getBlockSummary(height: number): Promise<DataEnvelope<BlockSummary>>;
}

export function createRpcClient(network: NetworkConfig): RpcClient {
  let clientPromise: Promise<Tm2Client> | null = null;
  function getClient(): Promise<Tm2Client> {
    if (!clientPromise) {
      clientPromise = connectTm2Client(network.rpcUrl);
    }
    return clientPromise;
  }

  const baseRef = {
    uri: `gno://${network.id}/network/${network.id}`,
    kind: "network" as const,
    networkId: network.id,
  };

  return {
    async getStatus() {
      const client = await getClient();
      const status = await client.status();
      const latestHeight = Number(status.syncInfo.latestBlockHeight);
      const chainId = status.nodeInfo.network;
      return wrapEnvelope({
        ref: baseRef,
        data: { latestHeight, chainId },
        source: "rpc",
        consistency: "authoritative",
        networkId: network.id,
        chainId,
        height: latestHeight,
        fetchedAt: new Date().toISOString(),
        freshness: "live",
        schema: "gnomputer.rpc.status.v1",
      });
    },

    async queryRender(packagePath, path, fetchedAt) {
      const client = await getClient();
      const value = await abciQueryString(client, "vm/qrender", `${packagePath}:${path}`);
      return wrapEnvelope({
        ref: { ...baseRef, kind: "realm", packagePath },
        data: value,
        source: "rpc",
        consistency: "authoritative",
        networkId: network.id,
        fetchedAt,
        freshness: "live",
        schema: "gnomputer.rpc.render.v1",
      });
    },

    async queryFile(path, fetchedAt) {
      const client = await getClient();
      const value = await abciQueryString(client, "vm/qfile", path);
      return wrapEnvelope({
        ref: { ...baseRef, kind: "source-file", filePath: path },
        data: value,
        source: "rpc",
        consistency: "authoritative",
        networkId: network.id,
        fetchedAt,
        freshness: "live",
        schema: "gnomputer.rpc.file.v1",
      });
    },

    async getBlockSummary(height) {
      const client = await getClient();
      const result = await client.block(height);
      const summary: BlockSummary = {
        height,
        time: result.block.header.time.toISOString(),
        numTxs: Number(result.block.header.numTxs),
      };
      return wrapEnvelope({
        ref: { ...baseRef, kind: "block", objectId: String(height) },
        data: summary,
        source: "rpc",
        consistency: "authoritative",
        networkId: network.id,
        height,
        fetchedAt: new Date().toISOString(),
        freshness: "live",
        schema: "gnomputer.rpc.block-summary.v1",
      });
    },
  };
}
