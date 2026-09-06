import { describe, it, expect } from "vitest";
import { IndexerRequestError } from "@gnomputer/app-sdk";
import { classifyChainError } from "./chain-error";

describe("classifyChainError", () => {
  it("labels a typed indexer 429 as rate-limited", () => {
    const error = new IndexerRequestError(429, "Too Many Requests", "indexer.example");
    expect(classifyChainError(error)).toBe("rate-limited");
  });

  it("labels a typed indexer 500 as neither — a real server error is not a rate limit", () => {
    const error = new IndexerRequestError(500, "Internal Server Error", "indexer.example");
    expect(classifyChainError(error)).toBeNull();
  });

  it("labels Tendermint2's 429 transport wording as rate-limited", () => {
    expect(classifyChainError(new Error("Bad status on response: 429"))).toBe("rate-limited");
  });

  it("labels Tendermint2's other statuses as neither", () => {
    expect(classifyChainError(new Error("Bad status on response: 500"))).toBeNull();
  });

  it("labels the browser's opaque fetch failure as unreachable, not rate-limited", () => {
    // Whether a CORS-blocked 429 keeps its status is unmeasured (issue #218) —
    // this is the honest, weaker label for the case where the status never
    // reached us at all.
    expect(classifyChainError(new TypeError("Failed to fetch"))).toBe("unreachable");
    expect(classifyChainError(new TypeError("NetworkError when attempting to fetch resource."))).toBe(
      "unreachable"
    );
  });

  it("labels an unrelated error as neither", () => {
    expect(classifyChainError(new Error("gno.land/r/demo/x has no Render() function."))).toBeNull();
  });

  it("labels a non-Error thrown value as neither", () => {
    expect(classifyChainError(null)).toBeNull();
    expect(classifyChainError(undefined)).toBeNull();
    expect(classifyChainError("boom")).toBeNull();
  });
});
