import type { EntityRef } from "@gnomputer/entities";
import { safeExternalUrl } from "./safe-url";

export interface RenderNode {
  type: "text" | "heading" | "paragraph" | "link" | "code" | "list-item";
  content?: string;
  href?: string;
  ref?: EntityRef;
  renderPath?: string;
  children?: RenderNode[];
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

function parseInlineLinks(text: string, currentPackagePath: string): RenderNode[] {
  const nodes: RenderNode[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(LINK_RE)) {
    const [full, label, href] = match;
    const index = match.index ?? 0;
    if (index > lastIndex) {
      nodes.push({ type: "text", content: unescapeMarkdown(text.slice(lastIndex, index)) });
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
    nodes.push({ type: "text", content: unescapeMarkdown(text.slice(lastIndex)) });
  }
  return nodes.length > 0 ? nodes : [{ type: "text", content: unescapeMarkdown(text) }];
}

const HEADING_RE = /^(#{1,6})\s+(.*)$/;

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
    LINK_RE.lastIndex = 0;
    if (LINK_RE.test(text)) {
      LINK_RE.lastIndex = 0;
      nodes.push({ type: "paragraph", children: parseInlineLinks(text, currentPackagePath) });
    } else {
      nodes.push({ type: "paragraph", content: unescapeMarkdown(text) });
    }
  }

  for (const line of lines) {
    const headingMatch = HEADING_RE.exec(line);
    if (!headingMatch) {
      paragraphLines.push(line);
      continue;
    }
    flushParagraph();
    const headingText = headingMatch[2]!;
    const level = headingMatch[1]!.length;
    LINK_RE.lastIndex = 0;
    if (LINK_RE.test(headingText)) {
      LINK_RE.lastIndex = 0;
      nodes.push({
        type: "heading",
        level,
        children: parseInlineLinks(headingText, currentPackagePath),
      });
    } else {
      nodes.push({ type: "heading", level, content: unescapeMarkdown(headingText) });
    }
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
