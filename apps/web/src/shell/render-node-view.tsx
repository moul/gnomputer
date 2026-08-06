import { Linkified } from "./linkify";
import { CodeEditor } from "./code-editor-lazy";
import { openInRealmTab } from "./open-in-realm-tab";
import { safeExternalUrl, type RenderNode } from "@gnomputer/lenses";

/** Renders one node of parseRenderMarkup's output tree — shared by the
 * Realm Browser's own Render lens and anywhere else that needs to show a
 * realm's Render() output with correctly-resolved internal links (the
 * Governance app, for gno.land/r/gov/dao). windowId is which Browser
 * window/tab an internal /r/... link opens into. */
export function RenderNodeView({ node, windowId }: { node: RenderNode; windowId: string }) {
  switch (node.type) {
    case "heading": {
      // Realm content lives inside a window, and the page's own <h1> names
      // the app — so a realm's "#" becomes an <h2> and everything nests
      // below that. Previously every level collapsed to <h2>, so a realm
      // with real structure read as a flat list of same-level headings.
      const Tag = `h${Math.min(6, (node.level ?? 1) + 1)}` as "h2";
      return (
        <Tag>
          {node.content !== undefined ? (
            <Linkified text={node.content} />
          ) : (
            node.children?.map((c, i) => <RenderNodeView key={i} node={c} windowId={windowId} />)
          )}
        </Tag>
      );
    }
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
    case "table":
      return <RenderTable node={node} windowId={windowId} />;
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

/** A realm's GFM table. The first row is always the header — parseTable
 * only produces a table when a delimiter row identified one, and GFM
 * requires the header above it — so this can emit a real <thead>/<th
 * scope="col"> rather than a grid of anonymous cells.
 *
 * The wrapper scrolls rather than the page: a realm can render as many
 * columns as it likes, and the shell must still have no horizontal scroll
 * at 320px. */
function RenderTable({ node, windowId }: { node: RenderNode; windowId: string }) {
  const [header, ...body] = node.children ?? [];
  if (!header) return null;
  return (
    <div className="render-table-scroll">
      <table className="render-table">
        <thead>
          <tr>
            {(header.children ?? []).map((cell, i) => (
              <th key={i} scope="col" style={cell.align ? { textAlign: cell.align } : undefined}>
                <RenderCellContent node={cell} windowId={windowId} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {(row.children ?? []).map((cell, i) => (
                <td key={i} style={cell.align ? { textAlign: cell.align } : undefined}>
                  <RenderCellContent node={cell} windowId={windowId} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A cell's inline children rendered without the <p> that the paragraph
 * case would wrap them in. */
function RenderCellContent({ node, windowId }: { node: RenderNode; windowId: string }) {
  return (
    <>
      {(node.children ?? []).map((child, i) => (
        <RenderNodeView key={i} node={child} windowId={windowId} />
      ))}
    </>
  );
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

  // Sanitized again here, not just at parse time (render-markup.ts), because
  // React does NOT sanitize href attributes — so this is the last line
  // before an untrusted string becomes a clickable navigation target. An
  // unsafe or missing href renders as plain text rather than a dead link, so
  // there's nothing to click at all.
  const safeHref = safeExternalUrl(node.href);
  if (!safeHref) return <>{node.content}</>;

  return (
    <a href={safeHref} target="_blank" rel="noopener noreferrer">
      {node.content}
    </a>
  );
}
