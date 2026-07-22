import { describe, it, expect } from "vitest";
import { availableLenses, lensUnavailableReason } from "./availability";

describe("availableLenses", () => {
  it("realm supports experience, source, docs, state, history, actions, graph, raw", () => {
    expect(availableLenses("realm")).toEqual(
      expect.arrayContaining([
        "experience",
        "source",
        "docs",
        "state",
        "history",
        "actions",
        "graph",
        "raw",
      ])
    );
  });

  it("transaction does not support the experience lens", () => {
    expect(availableLenses("transaction")).not.toContain("experience");
  });

  it("explains why an unavailable lens is unavailable", () => {
    expect(lensUnavailableReason("transaction", "experience")).toMatch(/not applicable/i);
  });

  it("returns null for an available lens", () => {
    expect(lensUnavailableReason("realm", "source")).toBeNull();
  });
});
