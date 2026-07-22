import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRpcClient } from "./client";
import { DEFAULT_NETWORKS } from "@gnomputer/networks";
import statusFixture from "./__fixtures__/status.json";
import qrenderFixture from "./__fixtures__/qrender.json";
import qfileFixture from "./__fixtures__/qfile.json";
import blockFixture from "./__fixtures__/block.json";

const test13 = DEFAULT_NETWORKS.find((n) => n.id === "test13")!;

function mockFetchWithFixtures() {
  global.fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as { method: string };
    const fixture =
      body.method === "status"
        ? statusFixture
        : body.method === "abci_query"
          ? qrenderOrQfile(init)
          : body.method === "block"
            ? blockFixture
            : {};
    return new Response(JSON.stringify(fixture), { headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
}

function qrenderOrQfile(init?: RequestInit) {
  const body = JSON.parse(String(init?.body ?? "{}")) as { params?: { path?: string } };
  return body.params?.path === "vm/qfile" ? qfileFixture : qrenderFixture;
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
  });
});
