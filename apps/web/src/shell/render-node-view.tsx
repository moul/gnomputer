import { Linkified } from "./linkify";
import { CodeEditor } from "./code-editor-lazy";
import { openInRealmTab } from "./open-in-realm-tab";
import type { RenderNode } from "@gnomputer/lenses";

/** Renders one node of parseRenderMarkup's output tree — shared by the
 * Realm Browser's own Render lens and anywhere else that needs to show a
 * realm's Render() output with correctly-resolved internal links (Discover's
 * Governance tab, for gno.land/r/gov/dao). windowId is which Browser
 * window/tab an internal /r/... link opens into. */
export function RenderNodeView({ node, windowId }: { node: RenderNode; windowId: string }) {
  switch (node.type) {
    case "heading":
      return (
        <h2>
          <Linkified text={node.content ?? ""} />
        </h2>
      );
    case "code":
      return (
        <div className="render-code-block">
          <CodeEditor
            value={node.content ?? ""}
            readOnly
            fill={false}
            language={node.lang === undefined || node.lang === "go" || node.lang === "gno" ? "go" : "text"}
          />
        </div>
      );
    case "link":
      return <GnoLink node={node} windowId={windowId} />;
    case "paragraph":
      return (
        <p>
          {node.content !== undefined ? (
            <Linkified text={node.content} />
          ) : (
            node.children?.map((c, i) => <RenderNodeView key={i} node={c} windowId={windowId} />)
          )}
        </p>
      );
    default:
      return (
        <span>
          <Linkified text={node.content ?? ""} />
        </span>
      );
  }
}

function GnoLink({ node, windowId }: { node: RenderNode; windowId: string }) {
  if (node.ref?.packagePath) {
    const packagePath = node.ref.packagePath;
    const renderPath = node.renderPath ?? "";
    return (
      <a
        href={`/?pkg=${encodeURIComponent(packagePath)}${renderPath ? `&path=${encodeURIComponent(renderPath)}` : ""}`}
        onClick={(e) => {
          e.preventDefault();
          openInRealmTab(windowId, { packagePath, renderPath });
        }}
      >
        {node.content}
      </a>
    );
  }

  return (
    <a href={node.href} target="_blank" rel="noopener noreferrer">
      {node.content}
    </a>
  );
}
