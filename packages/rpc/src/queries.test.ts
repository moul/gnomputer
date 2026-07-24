import { describe, it, expect, vi, afterEach } from "vitest";
import { abciQueryString, fetchValidatorsRaw, fetchBlockResultsRaw } from "./queries";
import type { Tm2Client } from "@gnolang/tm2-rpc";

function fakeClient(responseBase: { error?: unknown; data?: Uint8Array | null; log?: string }): Tm2Client {
  return {
    abciQuery: vi.fn().mockResolvedValue({
      responseBase: { error: null, data: new Uint8Array(), log: "", ...responseBase },
    }),
  } as unknown as Tm2Client;
}

describe("abciQueryString", () => {
  it("decodes the response data as a string on success", async () => {
    const data = new TextEncoder().encode("hello world");
    const client = fakeClient({ data });

    const result = await abciQueryString(client, "vm/qrender", "gno.land/r/demo/foo");

    expect(result).toBe("hello world");
  });

  it("throws using the log's human message when the response carries a VM-level error", async () => {
    const client = fakeClient({
      error: { "@type": "/vm.InvalidPkgPathError" },
      log: '    0  gno.land/pkg/gnolang/vm.go:58 - invalid package path: "gno.land/r/nope"',
    });

    await expect(abciQueryString(client, "vm/qrender", "gno.land/r/nope")).rejects.toThrow(
      'invalid package path: "gno.land/r/nope"'
    );
  });

  it("falls back to the error type's own name when the log has no usable message line", async () => {
    const client = fakeClient({
      error: { "@type": "/vm.InvalidPkgPathError" },
      log: "some unrelated log content with no stack-trace-shaped line",
    });

    await expect(abciQueryString(client, "vm/qrender", "gno.land/r/nope")).rejects.toThrow(
      "InvalidPkgPathError"
    );
  });
});

describe("fetchValidatorsRaw", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns the block height and validator list from a successful response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({
        result: {
          block_height: "12345",
          validators: [{ address: "g1abc", voting_power: "10", proposer_priority: "1" }],
        },
      }),
    }) as unknown as typeof fetch;

    const result = await fetchValidatorsRaw("http://localhost:26657", 12345);

    expect(result.blockHeight).toBe(12345);
    expect(result.validators).toEqual([{ address: "g1abc", voting_power: "10", proposer_priority: "1" }]);
  });

  it("throws with the server's error message when the JSON-RPC response carries an error", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ error: "height is not available" }),
    }) as unknown as typeof fetch;

    await expect(fetchValidatorsRaw("http://localhost:26657", 1)).rejects.toThrow(
      "height is not available"
    );
  });

  it("stringifies a non-string error object", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ error: { code: -32000, message: "boom" } }),
    }) as unknown as typeof fetch;

    await expect(fetchValidatorsRaw("http://localhost:26657", 1)).rejects.toThrow(/boom/);
  });
});

describe("fetchBlockResultsRaw", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns the height and deliver_tx list from a successful response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({
        result: {
          height: "500",
          results: { deliver_tx: [{ ResponseBase: { Error: null, Events: [] }, GasWanted: "1", GasUsed: "1" }] },
        },
      }),
    }) as unknown as typeof fetch;

    const result = await fetchBlockResultsRaw("http://localhost:26657", 500);

    expect(result.height).toBe(500);
    expect(result.deliverTx).toHaveLength(1);
  });

  it("defaults deliverTx to an empty array when the field isn't an array (e.g. an empty block)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({
        result: { height: "500", results: { deliver_tx: null } },
      }),
    }) as unknown as typeof fetch;

    const result = await fetchBlockResultsRaw("http://localhost:26657", 500);

    expect(result.deliverTx).toEqual([]);
  });

  it("throws when the JSON-RPC response carries an error", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ error: "block not found" }),
    }) as unknown as typeof fetch;

    await expect(fetchBlockResultsRaw("http://localhost:26657", 999999)).rejects.toThrow("block not found");
  });
});
