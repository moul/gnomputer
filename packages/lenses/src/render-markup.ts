import type { EntityRef } from "@gnomputer/entities";
import { safeExternalUrl } from "./safe-url";

export type RenderNodeType =
  | "text"
  | "heading"
  | "paragraph"
  | "link"
  | "code"
  | "code-inline"
  | "strong"
  | "emphasis"
  | "list"
  | "list-item"
  | "table"
  | "table-row"
  | "table-cell";

export interface RenderNode {
  type: RenderNodeType;
  content?: string;
  href?: string;
  ref?: EntityRef;
  renderPath?: string;
  children?: RenderNode[];
  /** Column alignment from the table's delimiter row (`:---`, `:---:`,
   * `---:`) — only set on table-cell nodes, and only when the delimiter
   * actually asked for one. */
  align?: "left" | "center" | "right";
  /** The fenced code block's language hint (```go, ```bash, ...), when
   * present — undefined for a bare ``` fence or any other node type. */
  lang?: string;
  /** 1-6, from the number of leading "#" — only set on heading nodes.
   * Without this the renderer had no way to tell an h1 from an h6 and
   * flattened every realm heading to the same level, destroying the
   * document outline screen readers navigate by (AUD-018). */
  level?: number;
}

interface ResolvedLink {
  ref?: EntityRef;
  renderPath?: string;
}

function realmRef(packagePath: string): EntityRef {
  return {
    uri: `gno://local/realm/${packagePath}`,
    kind: "realm",
    networkId: "local",
    packagePath,
  };
}

function resolveLink(href: string, currentPackagePath: string): ResolvedLink {
  if (/^https?:\/\//.test(href)) return {};

  // Gno's Render() supports its own sub-routing: a link can point at a render
  // sub-path within the SAME realm, either as "?query=string" or as
  // "/r/<realm>:<subpath>" — neither is a different package, just a different
  // argument to Render(path). Cross-realm links are plain "/r/<other>" with no
  // colon suffix.
  if (href.startsWith("?")) {
    return { ref: realmRef(currentPackagePath), renderPath: href };
  }

  if (!href.startsWith("/r/") && !href.startsWith("/p/")) return {};

  const domain = currentPackagePath.split("/")[0]!;
  const colonIndex = href.indexOf(":");
  const pathPart = colonIndex >= 0 ? href.slice(0, colonIndex) : href;
  const renderPath = colonIndex >= 0 ? href.slice(colonIndex + 1) : "";
  const packagePath = `${domain}${pathPart}`;
  return { ref: realmRef(packagePath), renderPath };
}

const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;

// Gno's Render() output escapes markdown-special characters that appear in
// literal content (e.g. "Add 11 validator\(s\)") so they don't get misread as
// markdown syntax. We don't implement a full markdown parser, so without this
// the escapes leak straight into the rendered text as visible backslashes.
function unescapeMarkdown(text: string): string {
  return text.replace(/\\([\\`*_{}[\]()#+.!>-])/g, "$1");
}

/**
 * `**bold**`, `*italic*` and `` `code` `` within a line.
 *
 * Realms lean on these constantly — the GRC20 registry renders every token as
 * `- **Name** - [path](…)` — and without them the asterisks arrived on screen
 * as literal text, which is what a reader saw instead of a bold name.
 *
 * Escapes are honoured: Render() output escapes markdown that appears in
 * literal content, so `\*` must stay an asterisk rather than open emphasis.
 */
const EMPHASIS_RE =
  /(?<!\\)(\*\*|__)([\s\S]+?)(?<!\\)\1|(?<!\\)([*_])([\s\S]+?)(?<!\\)\3|(?<!\\)`([^`]+?)`/g;

function parseEmphasis(text: string): RenderNode[] {
  const nodes: RenderNode[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(EMPHASIS_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      nodes.push({ type: "text", content: unescapeMarkdown(text.slice(lastIndex, index)) });
    }
    if (match[1]) {
      // Nested, so `**bold with *italic* inside**` keeps both.
      nodes.push({ type: "strong", children: parseEmphasis(match[2]!) });
    } else if (match[3]) {
      nodes.push({ type: "emphasis", children: parseEmphasis(match[4]!) });
    } else {
      // Code spans are literal by definition — no unescaping, no nesting.
      nodes.push({ type: "code-inline", content: match[5]! });
    }
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) {
    nodes.push({ type: "text", content: unescapeMarkdown(text.slice(lastIndex)) });
  }
  return nodes;
}

/** Emphasis-aware plain text, for the stretches between links. */
function inlineText(text: string): RenderNode[] {
  const nodes = parseEmphasis(text);
  return nodes.length > 0 ? nodes : [{ type: "text", content: unescapeMarkdown(text) }];
}

function parseInlineLinks(text: string, currentPackagePath: string): RenderNode[] {
  const nodes: RenderNode[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(LINK_RE)) {
    const [full, label, href] = match;
    const index = match.index ?? 0;
    if (index > lastIndex) {
      nodes.push(...inlineText(text.slice(lastIndex, index)));
    }
    const resolved = resolveLink(href!, currentPackagePath);
    nodes.push({
      type: "link",
      content: unescapeMarkdown(label!),
      // An internally-resolved link (a realm/package path) keeps its raw
      // relative href — consumers navigate via `ref`/`renderPath`, and
      // render-node-view builds its own in-app href, so the raw value is
      // never used as a navigation target. Anything NOT internally resolved
      // falls through to render-node-view's plain `<a href>`, so it is
      // sanitized here: a `javascript:`/`data:` link from untrusted Render()
      // output never even reaches a RenderNode as a usable href.
      href: resolved.ref ? href : safeExternalUrl(href),
      ref: resolved.ref,
      renderPath: resolved.renderPath,
    });
    lastIndex = index + full!.length;
  }
  if (lastIndex < text.length) {
    nodes.push(...inlineText(text.slice(lastIndex)));
  }
  return nodes.length > 0 ? nodes : inlineText(text);
}

/**
 * A block node holding inline content.
 *
 * Collapses to `content` when the inline parse produced nothing but text, so
 * an ordinary paragraph stays a flat node rather than growing a one-element
 * children array. Anything richer — a link, emphasis, a code span — keeps its
 * children.
 */
function inlineBlock(
  type: RenderNodeType,
  text: string,
  currentPackagePath: string,
  extra?: Partial<RenderNode>
): RenderNode {
  const children = parseInlineLinks(text, currentPackagePath);
  if (children.length === 1 && children[0]!.type === "text") {
    return { type, content: children[0]!.content, ...extra };
  }
  return { type, children, ...extra };
}

const HEADING_RE = /^(#{1,6})\s+(.*)$/;

// `- item`, `* item`, `+ item` and `1. item`. Indentation is allowed but not
// interpreted: nesting would need a tree, and Gno Render() output is flat in
// practice — a wrong-but-readable flat list beats one long joined line.
const LIST_ITEM_RE = /^\s*(?:[-*+]|\d+\.)\s+(.*)$/;

// A GFM delimiter row: the second line of every table, and the only thing
// that distinguishes a table from ordinary text that happens to contain
// pipes. Each column is dashes with optional leading/trailing colons for
// alignment. The outer pipes are optional in GFM, so both "|---|---|" and
// "---|---" are valid.
const TABLE_DELIMITER_RE = /^\s*\|?(?:\s*:?-+:?\s*\|)+\s*:?-*:?\s*\|?\s*$/;

/** Splits one table line into its cells.
 *
 * Pipes are the cell separator, so a literal pipe inside a cell is written
 * `\|` — split on unescaped pipes only, then unescape. The outer pipes are
 * structure rather than an empty first/last cell, so a single leading and
 * trailing one is stripped before splitting. */
function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells: string[] = [];
  let current = "";
  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i]!;
    if (char === "\\" && trimmed[i + 1] === "|") {
      current += "|";
      i++;
      continue;
    }
    if (char === "|") {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function parseAlignments(delimiterLine: string): (RenderNode["align"] | undefined)[] {
  return splitTableRow(delimiterLine).map((spec) => {
    const left = spec.startsWith(":");
    const right = spec.endsWith(":");
    if (left && right) return "center";
    if (right) return "right";
    if (left) return "left";
    return undefined;
  });
}

/** Builds one `table-row` whose children are `table-cell`s, normalized to
 * the header's column count: GFM drops cells past the header and pads a
 * short row with empty ones, so a ragged row can't shift the columns of
 * everything after it. */
function buildTableRow(
  line: string,
  columnCount: number,
  alignments: (RenderNode["align"] | undefined)[],
  currentPackagePath: string
): RenderNode {
  const cells = splitTableRow(line);
  const children: RenderNode[] = [];
  for (let i = 0; i < columnCount; i++) {
    const align = alignments[i];
    children.push({
      type: "table-cell",
      children: parseInlineLinks(cells[i] ?? "", currentPackagePath),
      ...(align ? { align } : {}),
    });
  }
  return { type: "table-row", children };
}

/** A GFM pipe table, which Gno realms use for any tabular Render() output.
 * Without this the lines fell through to the paragraph path and were joined
 * with spaces into one unreadable run of pipes and dashes.
 *
 * The first child row is always the header — GFM requires one, and the
 * delimiter row is what identifies the table at all, so there is no such
 * thing here as a table without one. */
function parseTable(
  lines: string[],
  start: number,
  currentPackagePath: string
): { node: RenderNode; nextIndex: number } | null {
  const headerLine = lines[start]!;
  const delimiterLine = lines[start + 1];
  if (delimiterLine === undefined || !TABLE_DELIMITER_RE.test(delimiterLine)) return null;
  if (!headerLine.includes("|")) return null;

  const headerCells = splitTableRow(headerLine);
  const alignments = parseAlignments(delimiterLine);
  // A delimiter row that doesn't describe the same number of columns as the
  // header isn't a table in GFM — treat it as ordinary text rather than
  // guessing which side is right.
  if (alignments.length !== headerCells.length) return null;

  const columnCount = headerCells.length;
  const rows: RenderNode[] = [
    buildTableRow(headerLine, columnCount, alignments, currentPackagePath),
  ];

  let index = start + 2;
  while (index < lines.length && lines[index]!.includes("|")) {
    rows.push(buildTableRow(lines[index]!, columnCount, alignments, currentPackagePath));
    index++;
  }

  return { node: { type: "table", children: rows }, nextIndex: index };
}

// A block (still relative to the outer \n\n+ split below) may pack several
// ATX headings and paragraph lines together with only single newlines
// between them — confirmed live: gno.land/r/gov/dao's Render() output does
// exactly this ("# GovDAO\n## Members\n[link](url)\n## Proposals\n..." all
// as one \n\n-delimited chunk). Standard Markdown treats a line starting
// with "#" as its own heading block regardless of blank-line separation, so
// headings need detecting per LINE here, not only when a heading happens to
// be a block's entire (single-line) content — the previous whole-block-only
// check left every one of these heading markers as literal "#" text.
function parseLines(lines: string[], currentPackagePath: string, nodes: RenderNode[]): void {
  let paragraphLines: string[] = [];

  function flushParagraph() {
    if (paragraphLines.length === 0) return;
    const text = paragraphLines.join(" ");
    paragraphLines = [];
    // Always through the inline parser, not only when a link is present.
    // Gating on links meant a line with `**bold**` and no link skipped inline
    // parsing altogether and arrived with its asterisks intact — which is
    // what r/sys/users showed.
    nodes.push(inlineBlock("paragraph", text, currentPackagePath));
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    // Tables are detected before headings and paragraphs because a table is
    // recognised by its *second* line, so the header row has to be held
    // back rather than flushed into the paragraph buffer first.
    if (line.includes("|")) {
      const table = parseTable(lines, i, currentPackagePath);
      if (table) {
        flushParagraph();
        nodes.push(table.node);
        i = table.nextIndex - 1;
        continue;
      }
    }

    // A run of list lines becomes one list. Without this they fell through to
    // the paragraph buffer and were joined with spaces — the GRC20 registry's
    // 45 tokens arrived as a single unreadable line, each item's leading "-"
    // stranded mid-sentence.
    if (LIST_ITEM_RE.test(line)) {
      flushParagraph();
      const items: RenderNode[] = [];
      while (i < lines.length) {
        const itemMatch = LIST_ITEM_RE.exec(lines[i]!);
        if (!itemMatch) break;
        items.push(inlineBlock("list-item", itemMatch[1]!, currentPackagePath));
        i++;
      }
      // The loop above consumed the first non-item line; hand it back.
      i--;
      nodes.push({ type: "list", children: items });
      continue;
    }

    const headingMatch = HEADING_RE.exec(line);
    if (!headingMatch) {
      paragraphLines.push(line);
      continue;
    }
    flushParagraph();
    const headingText = headingMatch[2]!;
    const level = headingMatch[1]!.length;
    nodes.push(inlineBlock("heading", headingText, currentPackagePath, { level }));
  }
  flushParagraph();
}

export function parseRenderMarkup(markup: string, currentPackagePath: string): RenderNode[] {
  const blocks = markup.split(/\n\n+/);
  const nodes: RenderNode[] = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    // A raw HTML block (common in GitHub READMEs — a centered banner image,
    // a badge wrapped in a <div>/<a>, ...) has no rendering here at all; Gno
    // Render() output doesn't use this, so this only ever matches content
    // this parser was never meant to handle. Dropping it silently reads
    // better than showing the tags themselves as visible text.
    if (/^<[a-z][a-z0-9-]*[\s/>]/i.test(trimmed)) continue;

    const fenceMatch = /^```([a-z]*)\n?/.exec(trimmed);
    if (fenceMatch) {
      const lang = fenceMatch[1];
      nodes.push({
        type: "code",
        content: trimmed.replace(/^```[a-z]*\n?/, "").replace(/```$/, ""),
        lang: lang ? lang : undefined,
      });
      continue;
    }

    parseLines(trimmed.split("\n"), currentPackagePath, nodes);
  }

  return nodes;
}
