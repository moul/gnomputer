import type { EntityRef } from "@gnomputer/entities";

export interface RenderNode {
  type: "text" | "heading" | "paragraph" | "link" | "code" | "list-item";
  content?: string;
  href?: string;
  ref?: EntityRef;
  children?: RenderNode[];
}

function resolveLink(href: string, currentPackagePath: string): EntityRef | undefined {
  if (/^https?:\/\//.test(href)) return undefined;
  if (!href.startsWith("/r/") && !href.startsWith("/p/")) return undefined;

  const domain = currentPackagePath.split("/")[0]!;
  const packagePath = `${domain}${href}`;
  return {
    uri: `gno://local/realm/${packagePath}`,
    kind: "realm",
    networkId: "local",
    packagePath,
  };
}

const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;

function parseInlineLinks(text: string, currentPackagePath: string): RenderNode[] {
  const nodes: RenderNode[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(LINK_RE)) {
    const [full, label, href] = match;
    const index = match.index ?? 0;
    if (index > lastIndex) {
      nodes.push({ type: "text", content: text.slice(lastIndex, index) });
    }
    nodes.push({ type: "link", content: label, href, ref: resolveLink(href!, currentPackagePath) });
    lastIndex = index + full!.length;
  }
  if (lastIndex < text.length) {
    nodes.push({ type: "text", content: text.slice(lastIndex) });
  }
  return nodes.length > 0 ? nodes : [{ type: "text", content: text }];
}

export function parseRenderMarkup(markup: string, currentPackagePath: string): RenderNode[] {
  const blocks = markup.split(/\n\n+/);
  const nodes: RenderNode[] = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (headingMatch) {
      nodes.push({ type: "heading", content: headingMatch[2] });
      continue;
    }

    if (/^```/.test(trimmed)) {
      nodes.push({ type: "code", content: trimmed.replace(/^```[a-z]*\n?/, "").replace(/```$/, "") });
      continue;
    }

    LINK_RE.lastIndex = 0;
    if (LINK_RE.test(trimmed)) {
      LINK_RE.lastIndex = 0;
      nodes.push({ type: "paragraph", children: parseInlineLinks(trimmed, currentPackagePath) });
      continue;
    }

    nodes.push({ type: "paragraph", content: trimmed });
  }

  return nodes;
}
