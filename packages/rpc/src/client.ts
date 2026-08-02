import type { Tm2Client } from "@gnolang/tm2-rpc";
import type { JSONRPCProvider } from "@gnolang/tm2-js-client";
import type { NetworkConfig } from "@gnomputer/networks";
import { wrapEnvelope, type DataEnvelope } from "@gnomputer/core";
import { withDeadline, withDeadlines } from "./with-deadlines";
import { GnoJSONRPCProvider } from "@gnolang/gno-js-client";
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
  /** A package's top-level declarations (names, types, values) as Amino
   * JSON — confirmed live and reachable via plain abci_query, the same
   * backend gnoweb's own State Explorer tab uses (gnolang/gno PR #5283).
   * Raw JSON string; the caller (state-explorer.tsx) parses and decodes
   * it, since the full Amino type/value schema is large and UI-specific. */
  queryPkgJson(packagePath: string, fetchedAt: string): Promise<DataEnvelope<string>>;
  /** A single persisted object's full value by its ObjectID (e.g.
   * "<pkg-hash>:4") via vm/qobject_json — used to lazily expand a pointer/
   * ref the package-level query only gave an ObjectID for. */
  queryObjectJson(objectId: string, fetchedAt: string): Promise<DataEnvelope<string>>;
  /** A declared type's structure (struct field names, in the same order
   * object values list their fields) by type ID via vm/qtype_json — needed
   * to label a StructValue's Fields array, which carries values only, not
   * field names. */
  queryTypeJson(typeId: string, fetchedAt: string): Promise<DataEnvelope<string>>;
  /** A package's exported top-level function signatures (name, params,
   * results) as a raw JSON array via vm/qfuncs — confirmed live against a
   * real deployed realm (gno.land/r/gnoland/blog), same "no indexer needed"
   * VM query family as queryPkgJson/queryFile. A crossing function's first
   * param comes back named ".arg_0" with a Type string containing
   * ".uverse.realm" (the expanded realm-interface shape) — the same
   * fingerprint gnolang/gno's own gnopie CLI tool (PR #5444) uses to detect
   * `cur realm` params, confirmed by reading its real, live response
   * shape rather than gnopie's (draft, unmerged) source directly. */
  queryFuncs(packagePath: string, fetchedAt: string): Promise<DataEnvelope<string>>;
  /** Real, live package-path enumeration via vm/qpaths — a genuine prefix
   * scan over deployed packages (store.FindPathsByPrefix on the node side).
   * Kept over the indexer even now that the indexer is reachable from the
   * browser (ADR-018): the node-side scan has no 10,000-row cap. Empty
   * prefix matches everything. */
  listPackagesByPrefix(prefix: string, limit: number, fetchedAt: string): Promise<DataEnvelope<string[]>>;
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
  // Memoized so every call shares one connection — but the memo is cleared
  // when connecting FAILS. Caching a rejected promise meant one unreachable
  // moment poisoned the client for the lifetime of the page: every later
  // call awaited the same settled rejection and failed instantly, without
  // touching the network. Observed as an app that goes permanently dead
  // after a single blip — no polling, no retry, and a "Try again" button
  // that issues no request at all. Measured: exactly ONE request ever left
  // the browser.
  let clientPromise: Promise<Tm2Client> | null = null;
  function getClient(): Promise<Tm2Client> {
    if (!clientPromise) {
      clientPromise = withDeadline(connectTm2Client(network.rpcUrl), network.rpcUrl)
        // Deadlines on the connection itself and on every call made
        // through it — the tm2 client honours no timeout of its own.
        .then((client) => withDeadlines(client, network.rpcUrl))
        .catch((error: unknown) => {
          clientPromise = null;
          throw error;
        });
    }
    return clientPromise;
  }

  // Same no-caching-a-rejection rule as the others below.
  let gnoProviderPromise: Promise<GnoJSONRPCProvider> | null = null;
  function getGnoProvider(): Promise<GnoJSONRPCProvider> {
    if (!gnoProviderPromise) {
      gnoProviderPromise = withDeadline(
        GnoJSONRPCProvider.create(network.rpcUrl),
        network.rpcUrl
      )
        .then((provider) => withDeadlines(provider, network.rpcUrl))
        .catch((error: unknown) => {
          gnoProviderPromise = null;
          throw error;
        });
    }
    return gnoProviderPromise;
  }

  let providerPromise: Promise<JSONRPCProvider> | null = null;
  function getProvider(): Promise<JSONRPCProvider> {
    if (!providerPromise) {
      providerPromise = withDeadline(connectProvider(network.rpcUrl), network.rpcUrl)
        .then((provider) => withDeadlines(provider, network.rpcUrl))
        .catch((error: unknown) => {
          providerPromise = null;
          throw error;
        });
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
      // Routed through gno-js-client rather than abciQueryString so callers
      // get its TYPED errors — NoRenderDeclError, InvalidPkgPathError — and
      // can branch with instanceof instead of matching on message text. The
      // realm browser needs exactly that to gray out the Render tab for a
      // package that declares no Render function.
      //
      // Verified live against Topaz that this returns byte-identical output
      // to the hand-rolled query, and that both error types arrive with the
      // same messages the old code parsed out of the Go stack trace.
      const provider = await getGnoProvider();
      const value = await provider.getRenderOutput(packagePath, path);
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

    async queryPkgJson(packagePath, fetchedAt) {
      const client = await getClient();
      const value = await abciQueryString(client, "vm/qpkg_json", packagePath);
      return wrapEnvelope({
        ref: { ...baseRef, kind: "realm", packagePath },
        data: value,
        source: "rpc",
        consistency: "authoritative",
        networkId: network.id,
        fetchedAt,
        freshness: "live",
        schema: "gnomputer.rpc.pkg-json.v1",
      });
    },

    async queryObjectJson(objectId, fetchedAt) {
      const client = await getClient();
      const value = await abciQueryString(client, "vm/qobject_json", objectId);
      return wrapEnvelope({
        ref: { ...baseRef, kind: "state-object", objectId },
        data: value,
        source: "rpc",
        consistency: "authoritative",
        networkId: network.id,
        fetchedAt,
        freshness: "live",
        schema: "gnomputer.rpc.object-json.v1",
      });
    },

    async queryTypeJson(typeId, fetchedAt) {
      const client = await getClient();
      const value = await abciQueryString(client, "vm/qtype_json", typeId);
      return wrapEnvelope({
        ref: { ...baseRef, kind: "type" },
        data: value,
        source: "rpc",
        consistency: "authoritative",
        networkId: network.id,
        fetchedAt,
        freshness: "live",
        schema: "gnomputer.rpc.type-json.v1",
      });
    },

    async queryFuncs(packagePath, fetchedAt) {
      const client = await getClient();
      const value = await abciQueryString(client, "vm/qfuncs", packagePath);
      return wrapEnvelope({
        ref: { ...baseRef, kind: "realm", packagePath },
        data: value,
        source: "rpc",
        consistency: "authoritative",
        networkId: network.id,
        fetchedAt,
        freshness: "live",
        schema: "gnomputer.rpc.funcs.v1",
      });
    },

    async listPackagesByPrefix(prefix, limit, fetchedAt) {
      const client = await getClient();
      const raw = await abciQueryString(client, `vm/qpaths?limit=${limit}`, prefix);
      const paths = raw.split("\n").filter((p) => p !== "");
      return wrapEnvelope({
        ref: baseRef,
        data: paths,
        source: "rpc",
        consistency: "authoritative",
        networkId: network.id,
        fetchedAt,
        freshness: "live",
        schema: "gnomputer.rpc.package-paths.v1",
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
