import { describe, it, expect, beforeEach, afterEach } from "vitest";
import nock from "nock";
import { createRpcClient } from "./client";
import { DEFAULT_NETWORKS } from "@gnomputer/networks";
import statusFixture from "./__fixtures__/status.json";
import qrenderFixture from "./__fixtures__/qrender.json";
import qfileFixture from "./__fixtures__/qfile.json";
import blockFixture from "./__fixtures__/block.json";
import accountFixture from "./__fixtures__/account.json";
import accountUninitializedFixture from "./__fixtures__/account-uninitialized.json";
import validatorsFixture from "./__fixtures__/validators.json";
import qevalUsernameFixture from "./__fixtures__/qeval-username.json";
import qevalUsernameNilFixture from "./__fixtures__/qeval-username-nil.json";
import blockResultsFixture from "./__fixtures__/block-results.json";
import qpathsFixture from "./__fixtures__/qpaths.json";
import qrenderInvalidPathFixture from "./__fixtures__/qrender-invalid-path.json";
import qpkgJsonFixture from "./__fixtures__/qpkg-json.json";
import qobjectJsonFixture from "./__fixtures__/qobject-json.json";
import qtypeJsonFixture from "./__fixtures__/qtype-json.json";

const topaz = DEFAULT_NETWORKS.find((n) => n.id === "topaz")!;
const FUNDED_ADDRESS = "g1jg8mtutu9khhfwc4nxmuhcpftf0pajdhfvsqf5";
const UNFUNDED_ADDRESS = "g1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqzp0nh0";

// Every RpcClient method funnels through ONE shared transport, regardless
// of which higher-level class calls it: Tm2Client.abciQuery/status/block/
// validators AND JSONRPCProvider.getAccount (which just wraps its own
// internal Tm2Client) both bottom out in @gnolang/tm2-rpc's
// dist/rpcclients/http.mjs, which does `import fetch from "cross-fetch"`.
// Mocking global.fetch (the previous approach) silently mocked nothing —
// cross-fetch never reads globalThis.fetch — and vi.mock("cross-fetch")
// also silently fails to intercept here: pnpm's strict node_modules means
// packages/rpc/src/client.test.ts and @gnolang/tm2-rpc's own import of
// "cross-fetch" resolve through different dependency scopes, so vitest's
// mock registry (keyed per resolution) misses the one tm2-rpc actually
// uses. Confirmed empirically: even an unconditionally-throwing
// vi.mock("cross-fetch") left every test passing — proof every one of
// these was secretly hitting the real network the whole time, and only
// ever passed because the fixture data happened to still match live
// chain state (getAccountInfo's exact balance/sequence was one real
// transaction on that account away from breaking outright).
//
// nock patches Node's http/https module directly — the layer every one
// of these libraries' request eventually goes through regardless of
// which higher-level "fetch" wrapper or import path it took to get
// there — so it isn't exposed to this resolution-scope problem.
function mockRpcWithFixtures() {
  nock.disableNetConnect();
  nock(topaz.rpcUrl)
    .persist()
    .post(/.*/)
    .reply(200, (_uri, requestBody) => {
      const body = (typeof requestBody === "string" ? JSON.parse(requestBody) : requestBody) as {
        method?: string;
        params?: { path?: string; data?: string };
      };
      return fixtureFor(body);
    });
}

function abciQueryFixture(params: { path?: string; data?: string } | undefined) {
  const path = params?.path ?? "";
  if (path === "vm/qfile") return qfileFixture;
  if (path.startsWith("auth/accounts/")) {
    return path.endsWith(UNFUNDED_ADDRESS) ? accountUninitializedFixture : accountFixture;
  }
  if (path === "vm/qeval") {
    const decoded = params?.data ? atob(params.data) : "";
    return decoded.includes(UNFUNDED_ADDRESS) ? qevalUsernameNilFixture : qevalUsernameFixture;
  }
  if (path.startsWith("vm/qpaths")) return qpathsFixture;
  if (path === "vm/qrender") {
    const decoded = params?.data ? atob(params.data) : "";
    if (decoded.startsWith("gno.land/r/does/not/exist")) return qrenderInvalidPathFixture;
    return qrenderFixture;
  }
  if (path === "vm/qpkg_json") return qpkgJsonFixture;
  if (path === "vm/qobject_json") return qobjectJsonFixture;
  if (path === "vm/qtype_json") return qtypeJsonFixture;
  return qrenderFixture;
}

function fixtureFor(body: { method?: string; params?: { path?: string; data?: string } }): unknown {
  switch (body.method) {
    case "status":
      return statusFixture;
    case "abci_query":
      return abciQueryFixture(body.params);
    case "block":
      return blockFixture;
    case "validators":
      return validatorsFixture;
    case "block_results":
      return blockResultsFixture;
    default:
      return {};
  }
}

describe("createRpcClient", () => {
  beforeEach(() => {
    mockRpcWithFixtures();
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  it("wraps getStatus in a DataEnvelope with source=rpc", async () => {
    const client = createRpcClient(topaz);
    const env = await client.getStatus();
    expect(env.source).toBe("rpc");
    expect(env.consistency).toBe("authoritative");
    expect(env.data.chainId).toBe("test-13");
    expect(typeof env.data.latestHeight).toBe("number");
  });

  it("wraps queryRender in a DataEnvelope with the decoded render output", async () => {
    const client = createRpcClient(topaz);
    const env = await client.queryRender("gno.land/r/sys/users", "", "2026-07-22T00:00:00.000Z");
    expect(env.source).toBe("rpc");
    expect(env.data).toContain("r/sys/users");
  });

  it("queryRender rejects with a readable message for a package that doesn't exist", async () => {
    const client = createRpcClient(topaz);
    await expect(
      client.queryRender("gno.land/r/does/not/exist", "", "2026-07-22T00:00:00.000Z")
    ).rejects.toThrow("package not found: gno.land/r/does/not/exist");
  });

  it("wraps queryFile in a DataEnvelope with the decoded source", async () => {
    const client = createRpcClient(topaz);
    const env = await client.queryFile("gno.land/r/sys/users/render.gno", "2026-07-22T00:00:00.000Z");
    expect(env.source).toBe("rpc");
    expect(env.data).toContain("package users");
  });

  it("wraps getBlockSummary in a DataEnvelope with real header fields", async () => {
    const client = createRpcClient(topaz);
    const env = await client.getBlockSummary(985592);
    expect(env.source).toBe("rpc");
    expect(env.data.height).toBe(985592);
    expect(env.data.numTxs).toBe(1);
    expect(env.data.time).toBe("2026-07-22T13:43:17.729Z");
    expect(env.data.totalTxs).toBe(1591491);
    expect(env.data.proposerAddress).toBe("g1vcsg3ek69yxvq6f65avw7zl572982r2z9z2r33");
    expect(env.data.version).toBe("v1.0.0-rc.0");
    expect(env.data.dataHashHex).toBe(
      "a1de8562618552b890bd0aead1f2b8d4cea13830619a4e18536e5520d46ee700"
    );
  });

  it("wraps getAccountInfo for a funded, initialized account", async () => {
    const client = createRpcClient(topaz);
    const env = await client.getAccountInfo(FUNDED_ADDRESS, "2026-07-22T00:00:00.000Z");
    expect(env.source).toBe("rpc");
    expect(env.data.initialized).toBe(true);
    expect(env.data.accountNumber).toBe(2701052);
    expect(env.data.sequence).toBe(122);
    expect(env.data.balance).toBe("272053418ugnot");
  });

  it("wraps getAccountInfo for an uninitialized account without throwing", async () => {
    const client = createRpcClient(topaz);
    const env = await client.getAccountInfo(UNFUNDED_ADDRESS, "2026-07-22T00:00:00.000Z");
    expect(env.data.initialized).toBe(false);
  });

  it("resolves a registered username via vm/qeval", async () => {
    const client = createRpcClient(topaz);
    const env = await client.resolveUsername(FUNDED_ADDRESS, "2026-07-22T00:00:00.000Z");
    expect(env.source).toBe("rpc");
    expect(env.data.username).toBe("test1");
  });

  it("resolves to a null username for an address with no registration", async () => {
    const client = createRpcClient(topaz);
    const env = await client.resolveUsername(UNFUNDED_ADDRESS, "2026-07-22T00:00:00.000Z");
    expect(env.data.username).toBeNull();
  });

  it("evalExpression returns the raw vm/qeval result for the given packagePath and expression", async () => {
    const client = createRpcClient(topaz);
    const env = await client.evalExpression(
      "gno.land/r/sys/users",
      `ResolveAddress("${FUNDED_ADDRESS}")`,
      "2026-07-22T00:00:00.000Z"
    );
    expect(env.source).toBe("rpc");
    expect(env.schema).toBe("gnomputer.rpc.eval.v1");
    expect(env.data).toContain('"test1" string');
  });

  it("evalExpression reflects a different expression argument in its result", async () => {
    const client = createRpcClient(topaz);
    const env = await client.evalExpression(
      "gno.land/r/sys/users",
      `ResolveAddress("${UNFUNDED_ADDRESS}")`,
      "2026-07-22T00:00:00.000Z"
    );
    expect(env.data.trim().startsWith("(nil")).toBe(true);
  });

  it("wraps listPackagesByPrefix in a DataEnvelope with the decoded, newline-split paths", async () => {
    const client = createRpcClient(topaz);
    const env = await client.listPackagesByPrefix("gno.land/r/", 50, "2026-07-22T00:00:00.000Z");
    expect(env.source).toBe("rpc");
    expect(env.schema).toBe("gnomputer.rpc.package-paths.v1");
    expect(env.data).toEqual(["gno.land/r/gnoland/blog", "gno.land/r/sys/users", "gno.land/r/gov/dao"]);
  });

  it("wraps getBlockEvents with real per-tx ABCI events (no indexer, no CORS wall)", async () => {
    const client = createRpcClient(topaz);
    const env = await client.getBlockEvents(985592, "2026-07-22T00:00:00.000Z");
    expect(env.source).toBe("rpc");
    expect(env.data.height).toBe(985592);
    expect(env.data.txs).toHaveLength(1);

    const tx = env.data.txs[0]!;
    expect(tx.success).toBe(true);
    expect(tx.gasWanted).toBe(458800000);
    expect(tx.gasUsed).toBe(226636261);
    expect(tx.events.length).toBe(22);
    expect(tx.events[0]).toEqual({
      type: "Approval",
      pkgPath: "gno.land/p/demo/tokens/grc20",
      attrs: [
        { key: "token", value: "gno.land/r/gnoswap/gns.GNS" },
        { key: "owner", value: "g1jc9kculnumsdtwtwlg8ha6ag6sawqqn0taz38k" },
        { key: "spender", value: "g1vc883gshu5z7ytk5cdynhc8c2dh67pdp4cszkp" },
        { key: "value", value: "14872957" },
      ],
    });
  });

  it("wraps getValidatorSet with real bech32 addresses, not raw bytes", async () => {
    const client = createRpcClient(topaz);
    const env = await client.getValidatorSet("2026-07-22T00:00:00.000Z");
    expect(env.source).toBe("rpc");
    expect(env.data.validators.length).toBeGreaterThan(0);
    expect(env.data.validators[0]!.address).toMatch(/^g1[a-z0-9]+$/);
    expect(typeof env.data.validators[0]!.votingPower).toBe("string");
  });

  it("wraps queryPkgJson in a DataEnvelope with the package's declarations as Amino JSON", async () => {
    const client = createRpcClient(topaz);
    const env = await client.queryPkgJson("gno.land/r/gnoland/blog", "2026-07-22T00:00:00.000Z");
    expect(env.source).toBe("rpc");
    const parsed = JSON.parse(env.data);
    expect(parsed.names).toContain("errNotAdmin");
    expect(parsed.values[0].T["@type"]).toBe("/gno.PointerType");
  });

  it("wraps queryObjectJson in a DataEnvelope with a persisted object's full value", async () => {
    const client = createRpcClient(topaz);
    const env = await client.queryObjectJson("abc123:5", "2026-07-22T00:00:00.000Z");
    const parsed = JSON.parse(env.data);
    expect(parsed.objectid).toBe("abc123:5");
    expect(parsed.value["@type"]).toBe("/gno.StructValue");
    expect(parsed.value.Fields[0].V.value).toBe("access restricted: not admin");
  });

  it("wraps queryTypeJson in a DataEnvelope with the declared type's struct field names", async () => {
    const client = createRpcClient(topaz);
    const env = await client.queryTypeJson("errors.errorString", "2026-07-22T00:00:00.000Z");
    const parsed = JSON.parse(env.data);
    expect(parsed.typeid).toBe("errors.errorString");
    expect(parsed.type.Base.Fields[0].Name).toBe("s");
  });
});
