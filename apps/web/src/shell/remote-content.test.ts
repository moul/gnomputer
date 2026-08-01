// @vitest-environment node
//
// Runs under node, not jsdom: jsdom has no AbortSignal.any, which this
// module uses to compose the deadline with the caller signal. Nothing here
// touches the DOM. Browser support is not a new requirement — the chain
// adapter fetch-with-deadline already ships the same call.
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  fetchRemoteJson,
  fetchRemoteText,
  RemoteContentError,
  REMOTE_TIMEOUT_MS,
} from "./remote-content";

const URL_UNDER_TEST = "https://api.github.com/repos/gnolang/gno/git/trees/master";

function respond(init: {
  status?: number;
  headers?: Record<string, string>;
  body?: string;
}): Response {
  return new Response(init.body ?? "", {
    status: init.status ?? 200,
    headers: init.headers,
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("fetchRemoteText", () => {
  it("returns the body on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond({ body: "# hello" })));
    await expect(fetchRemoteText(URL_UNDER_TEST)).resolves.toBe("# hello");
  });

  it("explains a GitHub rate limit instead of saying 403 Forbidden", async () => {
    // Unauthenticated api.github.com allows 60 requests an hour per IP.
    // Exhausting it used to surface as a bare "403 Forbidden", which reads
    // as a permissions problem and gives no hint that waiting fixes it.
    const resetInSeconds = Math.floor(Date.now() / 1000) + 25 * 60;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        respond({
          status: 403,
          headers: {
            "x-ratelimit-remaining": "0",
            "x-ratelimit-reset": String(resetInSeconds),
          },
        })
      )
    );
    await expect(fetchRemoteText(URL_UNDER_TEST)).rejects.toThrow(/rate limit/i);
    await expect(fetchRemoteText(URL_UNDER_TEST)).rejects.toThrow(/25 minutes/);
  });

  it("does not claim a rate limit for a 403 that isn't one", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        respond({ status: 403, headers: { "x-ratelimit-remaining": "58" } })
      )
    );
    await expect(fetchRemoteText(URL_UNDER_TEST)).rejects.toThrow(/^403/);
  });

  it("reports a 404 with the URL that was missing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond({ status: 404 })));
    await expect(fetchRemoteText(URL_UNDER_TEST)).rejects.toThrow(/Not found/);
  });

  it("names the host when the request never reaches it", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(fetchRemoteText(URL_UNDER_TEST)).rejects.toThrow(/api\.github\.com/);
  });
});

describe("fetchRemoteJson", () => {
  it("parses a JSON body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond({ body: '{"tree":[]}' })));
    await expect(fetchRemoteJson(URL_UNDER_TEST)).resolves.toEqual({ tree: [] });
  });

  it("says the response wasn't JSON rather than throwing a parser error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond({ body: "<html>oops" })));
    await expect(fetchRemoteJson(URL_UNDER_TEST)).rejects.toThrow(RemoteContentError);
    await expect(fetchRemoteJson(URL_UNDER_TEST)).rejects.toThrow(/isn't JSON/);
  });
});

describe("signals", () => {
  it("composes the caller's signal with the deadline instead of replacing it", async () => {
    // Replacing it would silently disable react-query's unmount
    // cancellation — the same mistake fetch-with-deadline exists to avoid.
    const fetchMock = vi.fn().mockResolvedValue(respond({ body: "ok" }));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    await fetchRemoteText(URL_UNDER_TEST, controller.signal);

    const passed = fetchMock.mock.calls[0]![1]!.signal as AbortSignal;
    expect(passed).not.toBe(controller.signal);
    expect(passed.aborted).toBe(false);
    controller.abort();
    expect(passed.aborted).toBe(true);
  });

  it("re-raises the caller's abort as-is, not as a timeout", async () => {
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("Aborted", "AbortError"))
    );
    await expect(fetchRemoteText(URL_UNDER_TEST, controller.signal)).rejects.toThrow(
      /Aborted/
    );
  });

  it("uses the same deadline as the chain adapter", () => {
    expect(REMOTE_TIMEOUT_MS).toBe(15_000);
  });
});
