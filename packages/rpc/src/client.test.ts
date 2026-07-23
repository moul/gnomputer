import { describe, it, expect, vi, beforeEach } from "vitest";
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

const test13 = DEFAULT_NETWORKS.find((n) => n.id === "test13")!;
const FUNDED_ADDRESS = "g1jg8mtutu9khhfwc4nxmuhcpftf0pajdhfvsqf5";
const UNFUNDED_ADDRESS = "g1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqzp0nh0";

function abciQueryFixture(init?: RequestInit) {
  const body = JSON.parse(String(init?.body ?? "{}")) as {
    params?: { path?: string; data?: string };
  };
  const path = body.params?.path ?? "";
  if (path === "vm/qfile") return qfileFixture;
  if (path.startsWith("auth/accounts/")) {
    return path.endsWith(UNFUNDED_ADDRESS) ? accountUninitializedFixture : accountFixture;
  }
  if (path === "vm/qeval") {
    const decoded = body.params?.data ? atob(body.params.data) : "";
    return decoded.includes(UNFUNDED_ADDRESS) ? qevalUsernameNilFixture : qevalUsernameFixture;
  }
  return qrenderFixture;
}

function mockFetchWithFixtures() {
  global.fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as { method: string };
    const fixture =
      body.method === "status"
        ? statusFixture
        : body.method === "abci_query"
          ? abciQueryFixture(init)
          : body.method === "block"
            ? blockFixture
            : body.method === "validators"
              ? validatorsFixture
              : body.method === "block_results"
                ? blockResultsFixture
                : {};
    return new Response(JSON.stringify(fixture), { headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
}

describe("createRpcClient", () => {
  beforeEach(() => {
    mockFetchWithFixtures();
  });

  it("wraps getStatus in a DataEnvelope with source=rpc", async () => {
    const client = createRpcClient(test13);
    const env = await client.getStatus();
    expect(env.source).toBe("rpc");
    expect(env.consistency).toBe("authoritative");
    expect(env.data.chainId).toBe("test-13");
    expect(typeof env.data.latestHeight).toBe("number");
  });

  it("wraps queryRender in a DataEnvelope with the decoded render output", async () => {
    const client = createRpcClient(test13);
    const env = await client.queryRender("gno.land/r/sys/users", "", "2026-07-22T00:00:00.000Z");
    expect(env.source).toBe("rpc");
    expect(env.data).toContain("r/sys/users");
  });

  it("wraps queryFile in a DataEnvelope with the decoded source", async () => {
    const client = createRpcClient(test13);
    const env = await client.queryFile("gno.land/r/sys/users/render.gno", "2026-07-22T00:00:00.000Z");
    expect(env.source).toBe("rpc");
    expect(env.data).toContain("package users");
  });

  it("wraps getBlockSummary in a DataEnvelope with real header fields", async () => {
    const client = createRpcClient(test13);
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
    const client = createRpcClient(test13);
    const env = await client.getAccountInfo(FUNDED_ADDRESS, "2026-07-22T00:00:00.000Z");
    expect(env.source).toBe("rpc");
    expect(env.data.initialized).toBe(true);
    expect(env.data.accountNumber).toBe(2701052);
    expect(env.data.sequence).toBe(122);
    expect(env.data.balance).toBe("272053418ugnot");
  });

  it("wraps getAccountInfo for an uninitialized account without throwing", async () => {
    const client = createRpcClient(test13);
    const env = await client.getAccountInfo(UNFUNDED_ADDRESS, "2026-07-22T00:00:00.000Z");
    expect(env.data.initialized).toBe(false);
  });

  it("resolves a registered username via vm/qeval", async () => {
    const client = createRpcClient(test13);
    const env = await client.resolveUsername(FUNDED_ADDRESS, "2026-07-22T00:00:00.000Z");
    expect(env.source).toBe("rpc");
    expect(env.data.username).toBe("test1");
  });

  it("resolves to a null username for an address with no registration", async () => {
    const client = createRpcClient(test13);
    const env = await client.resolveUsername(UNFUNDED_ADDRESS, "2026-07-22T00:00:00.000Z");
    expect(env.data.username).toBeNull();
  });

  it("evalExpression returns the raw vm/qeval result for the given packagePath and expression", async () => {
    const client = createRpcClient(test13);
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
    const client = createRpcClient(test13);
    const env = await client.evalExpression(
      "gno.land/r/sys/users",
      `ResolveAddress("${UNFUNDED_ADDRESS}")`,
      "2026-07-22T00:00:00.000Z"
    );
    expect(env.data.trim().startsWith("(nil")).toBe(true);
  });

  it("wraps getBlockEvents with real per-tx ABCI events (no indexer, no CORS wall)", async () => {
    const client = createRpcClient(test13);
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
    const client = createRpcClient(test13);
    const env = await client.getValidatorSet("2026-07-22T00:00:00.000Z");
    expect(env.source).toBe("rpc");
    expect(env.data.validators.length).toBeGreaterThan(0);
    expect(env.data.validators[0]!.address).toMatch(/^g1[a-z0-9]+$/);
    expect(typeof env.data.validators[0]!.votingPower).toBe("string");
  });
});
