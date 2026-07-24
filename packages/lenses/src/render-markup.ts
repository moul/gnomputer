import type { EntityRef } from "@gnomputer/entities";

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
      href,
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

export function parseRenderMarkup(markup: string, currentPackagePath: string): RenderNode[] {
  const blocks = markup.split(/\n\n+/);
  const nodes: RenderNode[] = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (headingMatch) {
      nodes.push({ type: "heading", content: unescapeMarkdown(headingMatch[2]!) });
      continue;
    }

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

    LINK_RE.lastIndex = 0;
    if (LINK_RE.test(trimmed)) {
      LINK_RE.lastIndex = 0;
      nodes.push({ type: "paragraph", children: parseInlineLinks(trimmed, currentPackagePath) });
      continue;
    }

    nodes.push({ type: "paragraph", content: unescapeMarkdown(trimmed) });
  }

  return nodes;
}
