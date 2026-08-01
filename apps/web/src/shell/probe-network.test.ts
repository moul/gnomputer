// @vitest-environment node
//
// Runs under node so AbortSignal.timeout and a real Response are available.
// Nothing here touches the DOM; window is stubbed where the mixed-content
// check needs it.
import { describe, it, expect, vi, afterEach } from "vitest";
import { probeNetwork, isLocalEndpoint } from "./probe-network";

afterEach(() => vi.unstubAllGlobals());

function statusResponse(chainId: string | null, height = "1234") {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      result: {
        node_info: chainId === null ? {} : { network: chainId },
        sync_info: { latest_block_height: height },
      },
    }),
    { status: 200 }
  );
}

describe("isLocalEndpoint", () => {
  it("recognises the origins browsers treat as trustworthy over plain http", () => {
    expect(isLocalEndpoint("http://localhost:26657")).toBe(true);
    expect(isLocalEndpoint("http://127.0.0.1:26657")).toBe(true);
    expect(isLocalEndpoint("http://gnodev.localhost:26657")).toBe(true);
  });

  it("does not treat a remote host as local", () => {
    expect(isLocalEndpoint("https://rpc.topaz.testnets.gno.land")).toBe(false);
    // Not fooled by a hostname that merely contains the word.
    expect(isLocalEndpoint("https://localhost.example.com")).toBe(false);
  });

  it("returns false rather than throwing on a malformed URL", () => {
    expect(isLocalEndpoint("not a url")).toBe(false);
  });
});

describe("probeNetwork", () => {
  it("reads the chain ID off the endpoint instead of assuming it", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(statusResponse("topaz-1")));
    const result = await probeNetwork("https://rpc.topaz.testnets.gno.land");
    expect(result).toMatchObject({ ok: true, chainId: "topaz-1", height: 1234 });
  });

  it("sends params as an object, which is what Tendermint2 requires", async () => {
    // An empty array is rejected with "expected 1 parameters ([heightGte]),
    // got 0" — verified against live Topaz.
    const fetchMock = vi.fn().mockResolvedValue(statusResponse("topaz-1"));
    vi.stubGlobal("fetch", fetchMock);
    await probeNetwork("https://rpc.example.com");
    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as {
      method: string;
      params: unknown;
    };
    expect(body.method).toBe("status");
    expect(Array.isArray(body.params)).toBe(false);
    expect(body.params).toEqual({});
  });

  it("blocks a remote http endpoint from an https page before sending anything", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("window", { location: { protocol: "https:" } });

    const result = await probeNetwork("http://rpc.example.com");
    expect(result).toMatchObject({ ok: false, reason: "mixed-content" });
    // The point of checking first is not making a request that cannot work.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("still allows http for localhost from an https page", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(statusResponse("dev")));
    vi.stubGlobal("window", { location: { protocol: "https:" } });
    await expect(probeNetwork("http://127.0.0.1:26657")).resolves.toMatchObject({ ok: true });
  });

  it("explains a CORS or unreachable failure differently for local and remote", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const remote = await probeNetwork("https://rpc.example.com");
    expect(remote).toMatchObject({ ok: false, reason: "unreachable" });
    expect((remote as { message: string }).message).toMatch(/CORS/);

    const local = await probeNetwork("http://127.0.0.1:26657");
    expect((local as { message: string }).message).toMatch(/running on that port/);
  });

  it("reports an HTTP error rather than calling it unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 404 })));
    expect(await probeNetwork("https://rpc.example.com")).toMatchObject({
      ok: false,
      reason: "http-error",
    });
  });

  it("rejects something that answers but is not a Tendermint2 node", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>", { status: 200 })));
    expect(await probeNetwork("https://example.com")).toMatchObject({
      ok: false,
      reason: "not-a-gno-rpc",
    });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(statusResponse(null)));
    expect(await probeNetwork("https://example.com")).toMatchObject({
      ok: false,
      reason: "not-a-gno-rpc",
    });
  });

  it("distinguishes a timeout from a refusal", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("timed out", "TimeoutError"))
    );
    expect(await probeNetwork("https://rpc.example.com")).toMatchObject({
      ok: false,
      reason: "timeout",
    });
  });
});
