import { describe, it, expect, afterEach } from "vitest";
import { createMockServer, type MockServerHandle } from "./index";

describe("createMockServer", () => {
  let server: MockServerHandle | undefined;
  afterEach(async () => {
    await server?.close();
  });

  it("serves a status response for the status JSON-RPC method", async () => {
    server = await createMockServer(0);
    const res = await fetch(server.url, {
      method: "POST",
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "status", params: {} }),
    });
    const body = await res.json();
    expect(body.result.node_info).toBeDefined();
  });

  it("serves a render response for an abci_query vm/qrender request", async () => {
    server = await createMockServer(0);
    const res = await fetch(server.url, {
      method: "POST",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "abci_query",
        params: { path: "vm/qrender", data: "" },
      }),
    });
    const body = await res.json();
    expect(body.result.response.ResponseBase.Data).toBeTruthy();
  });
});
