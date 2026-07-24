import { CodeEditor } from "./code-editor-lazy";
import type { RenderNode } from "@gnomputer/lenses";

// A read-only renderer for plain markdown content that has no Gno realm
// context (a docs page, a GitHub README) — unlike RenderNodeView
// (realm-browser.tsx), every link here just opens externally in a new tab,
// since there's no "current package" for a relative /r/ or /p/ link to
// resolve against.
export function MarkdownView({ nodes }: { nodes: RenderNode[] }) {
  return (
    <div className="markdown-view">
      {nodes.map((node, i) => (
        <MarkdownNodeView key={i} node={node} />
      ))}
    </div>
  );
}

function MarkdownNodeView({ node }: { node: RenderNode }) {
  switch (node.type) {
    case "heading":
      return <h3>{node.content}</h3>;
    case "code":
      return (
        <div className="render-code-block">
          <CodeEditor
            value={node.content ?? ""}
            readOnly
            fill={false}
            language={node.lang === "go" || node.lang === "gno" ? "go" : "text"}
          />
        </div>
      );
    case "link":
      return (
        <a href={node.href} target="_blank" rel="noopener noreferrer">
          {node.content}
        </a>
      );
    case "paragraph":
      return (
        <p>
          {node.content !== undefined
            ? node.content
            : node.children?.map((child, i) => <MarkdownNodeView key={i} node={child} />)}
        </p>
      );
    default:
      return <span>{node.content}</span>;
  }
}
