import type { Tm2Client } from "@gnolang/tm2-rpc";
import type { JSONRPCProvider } from "@gnolang/tm2-js-client";
import type { NetworkConfig } from "@gnomputer/networks";
import { wrapEnvelope, type DataEnvelope } from "@gnomputer/core";
import {
  connectTm2Client,
  connectProvider,
  abciQueryString,
  fetchValidatorsRaw,
  fetchBlockResultsRaw,
} from "./queries";

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface BlockSummary {
  height: number;
  time: string;
  numTxs: number;
  totalTxs: number;
  proposerAddress: string;
  version: string;
  appVersion: string;
  dataHashHex: string;
  validatorsHashHex: string;
}

export interface ValidatorInfo {
  address: string;
  votingPower: string;
  proposerPriority: string;
}

export interface ValidatorSet {
  height: number;
  validators: ValidatorInfo[];
}

export interface AccountInfo {
  address: string;
  accountNumber: number;
  sequence: number;
  balance: string;
  initialized: boolean;
}

export interface ChainEvent {
  type: string;
  pkgPath: string | null;
  attrs: { key: string; value: string }[];
}

export interface BlockTxResult {
  txIndex: number;
  success: boolean;
  gasWanted: number;
  gasUsed: number;
  events: ChainEvent[];
}

export interface BlockEvents {
  height: number;
  txs: BlockTxResult[];
}

export interface RpcClient {
  getStatus(): Promise<DataEnvelope<{ latestHeight: number; chainId: string }>>;
  queryRender(packagePath: string, path: string, fetchedAt: string): Promise<DataEnvelope<string>>;
  queryFile(path: string, fetchedAt: string): Promise<DataEnvelope<string>>;
  /** Evaluates a Gno expression against a realm's current state via
   * vm/qeval (e.g. expression `Render("")` against packagePath
   * "gno.land/r/gnoland/blog"). Throws on a VM-level error (bad syntax,
   * unknown identifier, panic) — the caller shows that message as-is. */
  evalExpression(packagePath: string, expression: string, fetchedAt: string): Promise<DataEnvelope<string>>;
  getBlockSummary(height: number): Promise<DataEnvelope<BlockSummary>>;
  getBlockEvents(height: number, fetchedAt: string): Promise<DataEnvelope<BlockEvents>>;
  getAccountInfo(address: string, fetchedAt: string): Promise<DataEnvelope<AccountInfo>>;
  getValidatorSet(fetchedAt: string): Promise<DataEnvelope<ValidatorSet>>;
  resolveUsername(address: string, fetchedAt: string): Promise<DataEnvelope<{ username: string | null }>>;
}

// Matches the value-tagged field in vm/qeval's Gno-syntax struct dump, e.g.
// `("test1" string)` inside `(&(struct{...("test1" string)...} ...UserData) ...)`.
// Distinct from the address field, which is tagged `.uverse.address` instead
// of `string`, so this can't accidentally grab the wrong quoted value.
const QEVAL_STRING_FIELD = /\("([^"]*)"\s+string\)/;

function parseResolveAddressUsername(raw: string): string | null {
  if (raw.trim().startsWith("(nil")) return null;
  return QEVAL_STRING_FIELD.exec(raw)?.[1] ?? null;
}

export function createRpcClient(network: NetworkConfig): RpcClient {
  let clientPromise: Promise<Tm2Client> | null = null;
  function getClient(): Promise<Tm2Client> {
    if (!clientPromise) {
      clientPromise = connectTm2Client(network.rpcUrl);
    }
    return clientPromise;
  }

  let providerPromise: Promise<JSONRPCProvider> | null = null;
  function getProvider(): Promise<JSONRPCProvider> {
    if (!providerPromise) {
      providerPromise = connectProvider(network.rpcUrl);
    }
    return providerPromise;
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

    async evalExpression(packagePath, expression, fetchedAt) {
      const client = await getClient();
      const value = await abciQueryString(client, "vm/qeval", `${packagePath}.${expression}`);
      return wrapEnvelope({
        ref: { ...baseRef, kind: "realm", packagePath },
        data: value,
        source: "rpc",
        consistency: "authoritative",
        networkId: network.id,
        fetchedAt,
        freshness: "live",
        schema: "gnomputer.rpc.eval.v1",
      });
    },

    async getBlockSummary(height) {
      const client = await getClient();
      const result = await client.block(height);
      const header = result.block.header;
      const summary: BlockSummary = {
        height,
        time: header.time.toISOString(),
        numTxs: Number(header.numTxs),
        totalTxs: Number(header.totalTxs),
        proposerAddress: header.proposerAddress,
        version: header.version,
        appVersion: header.appVersion,
        dataHashHex: toHex(header.dataHash),
        validatorsHashHex: toHex(header.validatorsHash),
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

    async getBlockEvents(height, fetchedAt) {
      const raw = await fetchBlockResultsRaw(network.rpcUrl, height);
      const txs: BlockTxResult[] = raw.deliverTx.map((tx, txIndex) => ({
        txIndex,
        success: tx.ResponseBase.Error === null,
        gasWanted: Number(tx.GasWanted),
        gasUsed: Number(tx.GasUsed),
        events: (tx.ResponseBase.Events ?? []).map((e) => ({
          type: e.type,
          pkgPath: e.pkg_path ?? null,
          attrs: e.attrs ?? [],
        })),
      }));
      return wrapEnvelope({
        ref: { ...baseRef, kind: "block", objectId: String(height) },
        data: { height: raw.height, txs },
        source: "rpc",
        consistency: "authoritative",
        networkId: network.id,
        height: raw.height,
        fetchedAt,
        freshness: "live",
        schema: "gnomputer.rpc.block-events.v1",
      });
    },

    async getAccountInfo(address, fetchedAt) {
      const provider = await getProvider();
      let info: AccountInfo;
      try {
        const account = await provider.getAccount(address);
        info = {
          address,
          accountNumber: Number(account.BaseAccount.account_number),
          sequence: Number(account.BaseAccount.sequence),
          balance: account.BaseAccount.coins,
          initialized: true,
        };
      } catch (err) {
        // tm2-js-client throws this exact message only when the ABCI response's data
        // is empty or fails to parse as an account — both mean "never funded, never
        // sent a tx," not a transport/decoding bug. Anything else must not be
        // swallowed here, or real failures (e.g. a broken response decoder) get
        // silently misreported as "this address has no activity."
        if (err instanceof Error && err.message === "account is not initialized") {
          info = { address, accountNumber: 0, sequence: 0, balance: "", initialized: false };
        } else {
          throw err;
        }
      }
      return wrapEnvelope({
        ref: { ...baseRef, kind: "account", objectId: address },
        data: info,
        source: "rpc",
        consistency: "authoritative",
        networkId: network.id,
        fetchedAt,
        freshness: "live",
        schema: "gnomputer.rpc.account.v1",
      });
    },

    async resolveUsername(address, fetchedAt) {
      const client = await getClient();
      const raw = await abciQueryString(
        client,
        "vm/qeval",
        `gno.land/r/sys/users.ResolveAddress("${address}")`
      );
      const username = parseResolveAddressUsername(raw);
      return wrapEnvelope({
        ref: { ...baseRef, kind: "address", objectId: address },
        data: { username },
        source: "rpc",
        consistency: "authoritative",
        networkId: network.id,
        fetchedAt,
        freshness: "live",
        schema: "gnomputer.rpc.username.v1",
      });
    },

    async getValidatorSet(fetchedAt) {
      const client = await getClient();
      const status = await client.status();
      // Querying the exact latest height sometimes races the chain producing
      // the next block between this call and the one above (observed live),
      // so back off by a few heights the same way getBlockSummary's callers
      // already have to.
      const height = Number(status.syncInfo.latestBlockHeight) - 2;
      const raw = await fetchValidatorsRaw(network.rpcUrl, height);
      const validatorSet: ValidatorSet = {
        height: raw.blockHeight,
        validators: raw.validators.map((v) => ({
          address: v.address,
          votingPower: v.voting_power,
          proposerPriority: v.proposer_priority,
        })),
      };
      return wrapEnvelope({
        ref: { ...baseRef, kind: "validator", objectId: "set" },
        data: validatorSet,
        source: "rpc",
        consistency: "authoritative",
        networkId: network.id,
        height: validatorSet.height,
        fetchedAt,
        freshness: "live",
        schema: "gnomputer.rpc.validator-set.v1",
      });
    },
  };
}
