import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchWithDeadline, RequestTimeoutError } from "./fetch-with-deadline";

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
  vi.useRealTimers();
});

describe("fetchWithDeadline", () => {
  it("passes a successful response straight through", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 }) as unknown as typeof fetch;
    const res = await fetchWithDeadline("https://example.com/rpc");
    expect(res.ok).toBe(true);
  });

  it("gives up on a hung endpoint instead of pending forever", async () => {
    // A server that accepts the connection and never answers — previously
    // this left the caller's promise unresolved indefinitely.
    global.fetch = vi.fn(
      (_u: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }))
          );
        })
    ) as unknown as typeof fetch;

    await expect(fetchWithDeadline("https://example.com/rpc", {}, 20)).rejects.toBeInstanceOf(
      RequestTimeoutError
    );
  });

  it("names the host and the timeout, so the error is actionable", async () => {
    global.fetch = vi.fn(
      (_u: string, init?: RequestInit) =>
        new Promise((_r, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        })
    ) as unknown as typeof fetch;

    await expect(fetchWithDeadline("https://rpc.example.com/x", {}, 1000)).rejects.toThrow(
      /rpc\.example\.com.*1s/
    );
  });

  it("still honours a caller's own AbortSignal (unmount cancellation)", async () => {
    const controller = new AbortController();
    global.fetch = vi.fn(
      (_u: string, init?: RequestInit) =>
        new Promise((_r, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(Object.assign(new Error("cancelled"), { name: "AbortError" }))
          );
        })
    ) as unknown as typeof fetch;

    const p = fetchWithDeadline("https://example.com/rpc", { signal: controller.signal }, 60_000);
    controller.abort();
    // Rejects as a cancellation, NOT as a timeout — the two mean different
    // things to the UI.
    await expect(p).rejects.not.toBeInstanceOf(RequestTimeoutError);
  });
});
