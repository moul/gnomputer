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

describe("heading levels", () => {
  it("records the real heading level instead of flattening every heading", () => {
    // Previously the level was discarded at parse time, so the renderer had
    // no way to distinguish an h1 from an h6 and emitted <h2> for all of
    // them — destroying the outline screen readers navigate by (AUD-018).
    const nodes = parseRenderMarkup("# One\n\n## Two\n\n#### Four", "gno.land/r/demo/a");
    const headings = nodes.filter((n) => n.type === "heading");
    expect(headings.map((h) => h.level)).toEqual([1, 2, 4]);
  });

  it("keeps the level on a heading that is entirely a link", () => {
    const nodes = parseRenderMarkup("### [Docs](https://docs.gno.land)", "gno.land/r/demo/a");
    const heading = nodes.find((n) => n.type === "heading");
    expect(heading?.level).toBe(3);
  });
});

describe("tables", () => {
  const GNOMEM_PATH = "gno.land/r/g1manfred47kzduec920z88wfr64ylksmdcedlf5/agents/gnomem";
  // Captured live from Topaz (vm/qrender on the path above) — the realm in
  // the bug report. Before table support these six lines were joined with
  // spaces into one unreadable run of pipes and dashes.
  const GNOMEM_RENDER = `# GnoMem — Contested Shared Memory

A graph of 2 structured claim(s) maintained by multiple agents.

| # | Claim | Status | ✋ support | ⚔ contest |
|---|---|---|---|---|
| [1](/r/g1manfred47kzduec920z88wfr64ylksmdcedlf5/agents/gnomem:1) | foo/v2 — is — safe to deploy | ♻️ superseded | 0 | 1 |
| [2](/r/g1manfred47kzduec920z88wfr64ylksmdcedlf5/agents/gnomem:2) | foo/v2 — is — unsafe before commit abc123 | ✋ supported | 1 | 0 |`;

  function cellText(cell: { children?: { content?: string }[] }): string {
    return (cell.children ?? []).map((c) => c.content ?? "").join("");
  }

  it("parses a real realm's table into header and body rows", () => {
    const nodes = parseRenderMarkup(GNOMEM_RENDER, GNOMEM_PATH);
    const table = nodes.find((n) => n.type === "table");
    expect(table).toBeDefined();
    // Header + two claims.
    expect(table!.children).toHaveLength(3);
    const [header, first] = table!.children!;
    expect(header!.children!.map(cellText)).toEqual([
      "#",
      "Claim",
      "Status",
      "✋ support",
      "⚔ contest",
    ]);
    expect(cellText(first!.children![1]!)).toBe("foo/v2 — is — safe to deploy");
    expect(cellText(first!.children![4]!)).toBe("1");
  });

  it("keeps the rest of the document around the table", () => {
    const nodes = parseRenderMarkup(GNOMEM_RENDER, GNOMEM_PATH);
    expect(nodes.map((n) => n.type)).toEqual(["heading", "paragraph", "table"]);
  });

  it("resolves a link inside a table cell like any other link", () => {
    const nodes = parseRenderMarkup(GNOMEM_RENDER, GNOMEM_PATH);
    const table = nodes.find((n) => n.type === "table")!;
    const firstCell = table.children![1]!.children![0]!;
    const link = firstCell.children![0]!;
    expect(link).toMatchObject({ type: "link", content: "1" });
    expect(link.ref?.packagePath).toBe(GNOMEM_PATH);
    expect(link.renderPath).toBe("1");
  });

  it("reads column alignment from the delimiter row", () => {
    const nodes = parseRenderMarkup(
      "| L | C | R |\n| :--- | :---: | ---: |\n| a | b | c |",
      "gno.land/r/demo/a"
    );
    const table = nodes.find((n) => n.type === "table")!;
    expect(table.children![1]!.children!.map((c) => c.align)).toEqual(["left", "center", "right"]);
  });

  it("leaves alignment undefined for a plain delimiter", () => {
    const nodes = parseRenderMarkup("| a |\n|---|\n| b |", "gno.land/r/demo/a");
    const table = nodes.find((n) => n.type === "table")!;
    expect(table.children![0]!.children![0]!.align).toBeUndefined();
  });

  it("normalizes a ragged row to the header's column count", () => {
    const nodes = parseRenderMarkup(
      "| a | b | c |\n|---|---|---|\n| 1 |\n| 1 | 2 | 3 | 4 |",
      "gno.land/r/demo/a"
    );
    const table = nodes.find((n) => n.type === "table")!;
    for (const row of table.children!) {
      expect(row.children).toHaveLength(3);
    }
    // The short row is padded...
    expect(cellText(table.children![1]!.children![1]!)).toBe("");
    // ...and the long one is truncated rather than shifting the columns.
    expect(table.children![2]!.children!.map(cellText)).toEqual(["1", "2", "3"]);
  });

  it("treats an escaped pipe as cell content, not a separator", () => {
    const nodes = parseRenderMarkup("| a \\| b | c |\n|---|---|\n| 1 | 2 |", "gno.land/r/demo/a");
    const table = nodes.find((n) => n.type === "table")!;
    expect(table.children![0]!.children!.map(cellText)).toEqual(["a | b", "c"]);
  });

  it("does not treat a paragraph containing a pipe as a table", () => {
    const nodes = parseRenderMarkup("Run `a | b` to pipe.", "gno.land/r/demo/a");
    expect(nodes.map((n) => n.type)).toEqual(["paragraph"]);
  });

  it("does not build a table when the delimiter's column count disagrees", () => {
    const nodes = parseRenderMarkup("| a | b | c |\n|---|---|\n| 1 | 2 | 3 |", "gno.land/r/demo/a");
    expect(nodes.every((n) => n.type !== "table")).toBe(true);
  });
});

describe("lists and inline emphasis", () => {
  it("groups consecutive list lines into one list", () => {
    // These fell through to the paragraph buffer and were joined with spaces:
    // the GRC20 registry's 45 tokens arrived as a single unreadable line.
    const nodes = parseRenderMarkup("- one\n- two\n- three", "gno.land/r/x");

    expect(nodes).toHaveLength(1);
    expect(nodes[0]!.type).toBe("list");
    expect(nodes[0]!.children).toHaveLength(3);
    expect(nodes[0]!.children![0]).toMatchObject({ type: "list-item", content: "one" });
  });

  it("accepts the other bullet markers and ordered items", () => {
    expect(parseRenderMarkup("* a\n+ b", "gno.land/r/x")[0]!.children).toHaveLength(2);
    expect(parseRenderMarkup("1. a\n2. b", "gno.land/r/x")[0]!.type).toBe("list");
  });

  it("ends the list at the first line that is not an item", () => {
    const nodes = parseRenderMarkup("- one\n- two\nafter", "gno.land/r/x");

    expect(nodes.map((n) => n.type)).toEqual(["list", "paragraph"]);
    expect(nodes[1]).toMatchObject({ content: "after" });
  });

  it("keeps links inside a list item", () => {
    // How the token registry renders every row: bold name, then a link.
    const nodes = parseRenderMarkup("- **Test** - [gno.land/r/a](/r/a)", "gno.land/r/x");
    const item = nodes[0]!.children![0]!;

    expect(item.children!.some((c) => c.type === "strong")).toBe(true);
    expect(item.children!.some((c) => c.type === "link")).toBe(true);
  });

  it("parses bold, italic and code spans", () => {
    const nodes = parseRenderMarkup("a **b** c *d* e `f`", "gno.land/r/x");
    const kinds = nodes[0]!.children!.map((c) => c.type);

    expect(kinds).toContain("strong");
    expect(kinds).toContain("emphasis");
    expect(kinds).toContain("code-inline");
  });

  it("parses emphasis in a paragraph that has no link at all", () => {
    // Inline parsing used to be gated on a link being present, so a line with
    // only bold kept its asterisks — what r/sys/users showed.
    const nodes = parseRenderMarkup("Total registered: **29**", "gno.land/r/x");

    expect(nodes[0]!.children!.some((c) => c.type === "strong")).toBe(true);
  });

  it("parses emphasis in a heading", () => {
    const nodes = parseRenderMarkup("# Hello **world**", "gno.land/r/x");

    expect(nodes[0]!.type).toBe("heading");
    expect(nodes[0]!.children!.some((c) => c.type === "strong")).toBe(true);
  });

  it("leaves an escaped asterisk as text rather than opening emphasis", () => {
    // Render() escapes markdown that appears in literal content.
    const nodes = parseRenderMarkup("a \\*not italic\\* b", "gno.land/r/x");

    expect(nodes[0]!.content).toBe("a *not italic* b");
  });

  it("keeps a plain paragraph flat rather than wrapping it in children", () => {
    const nodes = parseRenderMarkup("just text", "gno.land/r/x");

    expect(nodes[0]).toMatchObject({ type: "paragraph", content: "just text" });
    expect(nodes[0]!.children).toBeUndefined();
  });

  it("does not treat a code span's contents as markup", () => {
    const nodes = parseRenderMarkup("use `**not bold**` here", "gno.land/r/x");
    const code = nodes[0]!.children!.find((c) => c.type === "code-inline");

    expect(code!.content).toBe("**not bold**");
  });
});
