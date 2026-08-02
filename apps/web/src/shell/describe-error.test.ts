import { describe, it, expect } from "vitest";
import { describeError } from "./describe-error";

describe("describeError", () => {
  it("passes through an error this codebase wrote to be read", () => {
    const error = new Error("gno.land/r/demo/x has no Render() function.");
    expect(describeError(error).message).toBe("gno.land/r/demo/x has no Render() function.");
  });

  it("cuts a Gno stack trace off the end", () => {
    // Real shape, from a live Topaz qeval against an injected expression.
    const error = new Error(
      "operator + not defined on: TupleKind\n--- preprocess stack ---\nstack 1: func-lit :0:0\nstack 0: package gno.land/r/sys/users:0:0"
    );
    const described = describeError(error);
    expect(described.message).toBe("operator + not defined on: TupleKind");
    expect(described.message).not.toContain("stack");
  });

  it("keeps only the first line of any other multi-line error", () => {
    expect(describeError(new Error("Something broke\nat foo()\nat bar()")).message).toBe(
      "Something broke"
    );
  });

  it("replaces the browser's opaque fetch failure with something actionable", () => {
    // The same message covers a dropped connection, a DNS failure, a CORS
    // rejection and a blocked mixed-content request. Script cannot tell
    // them apart, so echoing it explains nothing.
    expect(describeError(new TypeError("Failed to fetch")).message).toMatch(
      /Check your connection/
    );
  });

  it("bounds the length rather than printing a wall of text", () => {
    const described = describeError(new Error("x".repeat(1000)));
    expect(described.message.length).toBeLessThanOrEqual(240);
    expect(described.message.endsWith("…")).toBe(true);
  });

  it("keeps the full text for the bug report even when the message is cut", () => {
    const error = new Error("boom\n--- preprocess stack ---\nstack 0: everything");
    const described = describeError(error);
    expect(described.message).toBe("boom");
    expect(described.detail).toContain("stack 0: everything");
  });

  it("does not show the stringified form of a thrown non-Error", () => {
    // "[object Object]" is not an explanation.
    expect(describeError({ code: 500 }).message).toBe("Something went wrong.");
    expect(describeError(null).message).toBe("Something went wrong.");
    expect(describeError(undefined).message).toBe("Something went wrong.");
  });

  it("does not show an empty message", () => {
    expect(describeError(new Error("")).message).toBe("Something went wrong.");
    expect(describeError(new Error("   \n  ")).message).toBe("Something went wrong.");
  });
});
