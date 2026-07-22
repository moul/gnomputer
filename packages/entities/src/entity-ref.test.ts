import { describe, it, expect } from "vitest";
import { EntityRefSchema } from "./entity-ref";

describe("EntityRefSchema", () => {
  it("accepts a minimal valid ref", () => {
    const result = EntityRefSchema.safeParse({
      uri: "gno://test13/realm/gno.land/r/demo/foo",
      kind: "realm",
      networkId: "test13",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown kind", () => {
    const result = EntityRefSchema.safeParse({
      uri: "gno://test13/bogus/x",
      kind: "bogus",
      networkId: "test13",
    });
    expect(result.success).toBe(false);
  });
});
