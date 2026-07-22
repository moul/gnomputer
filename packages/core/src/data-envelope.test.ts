import { describe, it, expect } from "vitest";
import { DataEnvelopeSchema, wrapEnvelope } from "./data-envelope";

const ref = {
  uri: "gno://test13/realm/gno.land/r/demo/foo",
  kind: "realm" as const,
  networkId: "test13",
};

describe("wrapEnvelope", () => {
  it("builds a valid envelope", () => {
    const env = wrapEnvelope({
      ref,
      data: { hello: "world" },
      source: "rpc",
      consistency: "authoritative",
      networkId: "test13",
      freshness: "live",
      schema: "test.v1",
      fetchedAt: "2026-07-22T00:00:00.000Z",
    });
    expect(DataEnvelopeSchema.safeParse(env).success).toBe(true);
  });

  it("rejects an invalid source", () => {
    const result = DataEnvelopeSchema.safeParse({
      ref,
      data: {},
      source: "made-up",
      consistency: "authoritative",
      networkId: "test13",
      freshness: "live",
      schema: "test.v1",
      fetchedAt: "2026-07-22T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });
});
