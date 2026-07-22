import { describe, it, expect } from "vitest";
import { parseRenderMarkup } from "./render-markup";

describe("parseRenderMarkup", () => {
  it("parses a heading and paragraph", () => {
    const nodes = parseRenderMarkup("# Hello\n\nSome text.", "gno.land/r/demo/foo");
    expect(nodes[0]).toMatchObject({ type: "heading", content: "Hello" });
    expect(nodes[1]).toMatchObject({ type: "paragraph" });
  });

  it("resolves a relative realm link to an EntityRef", () => {
    const nodes = parseRenderMarkup("[Other realm](/r/demo/bar)", "gno.land/r/demo/foo");
    const link = nodes[0]!.children?.[0] ?? nodes[0]!;
    expect(link).toMatchObject({ type: "link", href: "/r/demo/bar" });
    expect(link.ref?.packagePath).toBe("gno.land/r/demo/bar");
    expect(link.renderPath).toBe("");
  });

  it("leaves external links unresolved (no ref)", () => {
    const nodes = parseRenderMarkup("[External](https://example.com)", "gno.land/r/demo/foo");
    const link = nodes[0]!.children?.[0] ?? nodes[0]!;
    expect(link.ref).toBeUndefined();
  });

  it("resolves a same-realm colon sub-path without changing the package", () => {
    const nodes = parseRenderMarkup("[Prop #49](/r/gov/dao:49)", "gno.land/r/gov/dao");
    const link = nodes[0]!.children?.[0] ?? nodes[0]!;
    expect(link.ref?.packagePath).toBe("gno.land/r/gov/dao");
    expect(link.renderPath).toBe("49");
  });

  it("resolves a query-string pagination link to the current package", () => {
    const nodes = parseRenderMarkup("[2](?page=2)", "gno.land/r/gov/dao");
    const link = nodes[0]!.children?.[0] ?? nodes[0]!;
    expect(link.ref?.packagePath).toBe("gno.land/r/gov/dao");
    expect(link.renderPath).toBe("?page=2");
  });

  it("unescapes markdown-escaped punctuation in text and link labels", () => {
    const nodes = parseRenderMarkup(
      "Add 11 validator\\(s\\) to the valset",
      "gno.land/r/gov/dao"
    );
    expect(nodes[0]).toMatchObject({ type: "paragraph", content: "Add 11 validator(s) to the valset" });
  });
});
