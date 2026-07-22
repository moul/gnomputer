import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
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

  return (
    <section className="panel panel--realm">
      <header className="panel__header">
        <span>Experience · {packagePath}</span>
      </header>
      <div className="panel__body">
        {error ? (
          <p className="state-line" role="alert">
            Could not load this realm: {error}
          </p>
        ) : !nodes ? (
          <p className="state-line" aria-busy="true">
            Loading realm…
          </p>
        ) : (
          <article aria-label={`Realm ${packagePath}`}>
            {nodes.map((node, i) => (
              <RenderNodeView key={i} node={node} />
            ))}
          </article>
        )}
      </div>
    </section>
  );
}

function RenderNodeView({ node }: { node: RenderNode }) {
  switch (node.type) {
    case "heading":
      return <h2>{node.content}</h2>;
    case "code":
      return <pre>{node.content}</pre>;
    case "link":
      return <GnoLink node={node} />;
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

function GnoLink({ node }: { node: RenderNode }) {
  const navigate = useNavigate();

  if (node.ref?.packagePath) {
    const packagePath = node.ref.packagePath;
    return (
      <a
        href={`/?pkg=${encodeURIComponent(packagePath)}`}
        onClick={(e) => {
          e.preventDefault();
          void navigate({ to: "/", search: { pkg: packagePath } });
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
