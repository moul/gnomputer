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

  it("captures a fenced code block's language hint", () => {
    const nodes = parseRenderMarkup("```go\nfunc main() {}\n```", "gno.land/r/demo/foo");
    expect(nodes[0]).toMatchObject({ type: "code", lang: "go", content: "func main() {}\n" });
  });

  it("leaves lang undefined for a bare fence", () => {
    const nodes = parseRenderMarkup("```\nplain text\n```", "gno.land/r/demo/foo");
    expect(nodes[0]).toMatchObject({ type: "code", lang: undefined });
  });

  it("drops a raw HTML block instead of showing its tags as text", () => {
    const nodes = parseRenderMarkup(
      '<div align="center"><img src="./banner.png" /></div>\n\n# Real heading',
      "gno.land/r/demo/foo"
    );
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({ type: "heading", content: "Real heading" });
  });

  it("unescapes markdown-escaped punctuation in text and link labels", () => {
    const nodes = parseRenderMarkup(
      "Add 11 validator\\(s\\) to the valset",
      "gno.land/r/gov/dao"
    );
    expect(nodes[0]).toMatchObject({ type: "paragraph", content: "Add 11 validator(s) to the valset" });
  });

  // Confirmed live: gno.land/r/gov/dao's real Render() output packs several
  // ATX headings and a link, each on its own line, with only single
  // newlines between them (no blank-line separation) — the previous
  // whole-block-only heading check left every one of these as literal "#"
  // text instead of real heading nodes.
  it("recognizes each heading on its own line even without blank-line separation between them", () => {
    const nodes = parseRenderMarkup(
      "# GovDAO\n## Members\n[> Go to Memberstore <](/r/gov/dao/v3/memberstore)\n## Proposals",
      "gno.land/r/gov/dao"
    );
    expect(nodes[0]).toMatchObject({ type: "heading", content: "GovDAO" });
    expect(nodes[1]).toMatchObject({ type: "heading", content: "Members" });
    expect(nodes[2]).toMatchObject({ type: "paragraph" });
    const link = nodes[2]!.children?.[0];
    expect(link).toMatchObject({ type: "link", href: "/r/gov/dao/v3/memberstore" });
    expect(nodes[3]).toMatchObject({ type: "heading", content: "Proposals" });
  });

  it("parses a heading whose entire text is a markdown link", () => {
    const nodes = parseRenderMarkup(
      "### [Prop #19 - Add 6 validator\\(s\\) to the valset](/r/gov/dao:19)\nAuthor: g1abc",
      "gno.land/r/gov/dao"
    );
    expect(nodes[0]!.type).toBe("heading");
    const link = nodes[0]!.children?.[0];
    expect(link).toMatchObject({ type: "link", content: "Prop #19 - Add 6 validator(s) to the valset" });
    expect(link!.ref?.packagePath).toBe("gno.land/r/gov/dao");
    expect(link!.renderPath).toBe("19");
    expect(nodes[1]).toMatchObject({ type: "paragraph", content: "Author: g1abc" });
  });

  it("joins consecutive non-heading lines within a block into one paragraph", () => {
    const nodes = parseRenderMarkup("Line one\nLine two", "gno.land/r/demo/foo");
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({ type: "paragraph", content: "Line one Line two" });
  });
});
