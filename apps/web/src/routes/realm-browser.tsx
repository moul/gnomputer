import { useEffect, useState } from "react";
import { useSdk } from "../sdk-context";
import { useTrailRecorder } from "../use-trail-recorder";
import type { RenderNode } from "@gnomputer/lenses";

export function RealmBrowser({ packagePath }: { packagePath: string }) {
  const sdk = useSdk();
  const [nodes, setNodes] = useState<RenderNode[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useTrailRecorder({
    uri: `gno://${sdk.networks.getActive().id}/realm/${packagePath}`,
    label: packagePath,
  });

  useEffect(() => {
    setNodes(null);
    setError(null);
    sdk.rpc
      .queryRender(packagePath, "", new Date().toISOString())
      .then((env) => setNodes(sdk.lenses.parseRender(env.data, packagePath)))
      .catch((err: Error) => setError(err.message));
  }, [packagePath, sdk]);

  if (error) return <div role="alert">Could not load this realm: {error}</div>;
  if (!nodes) return <div aria-busy="true">Loading realm…</div>;

  return (
    <article aria-label={`Realm ${packagePath}`}>
      {nodes.map((node, i) => (
        <RenderNodeView key={i} node={node} />
      ))}
    </article>
  );
}

function RenderNodeView({ node }: { node: RenderNode }) {
  switch (node.type) {
    case "heading":
      return <h2>{node.content}</h2>;
    case "code":
      return <pre>{node.content}</pre>;
    case "link":
      return <a href={node.href}>{node.content}</a>;
    case "paragraph":
      return (
        <p>
          {node.content ?? node.children?.map((c, i) => <RenderNodeView key={i} node={c} />)}
        </p>
      );
    default:
      return <span>{node.content}</span>;
  }
}
