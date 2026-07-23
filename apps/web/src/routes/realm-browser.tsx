import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useSdk } from "../sdk-context";
import { useTrailRecorder } from "../use-trail-recorder";
import { Linkified } from "../shell/linkify";
import type { RenderNode } from "@gnomputer/lenses";

export function RealmBrowser({
  packagePath,
  renderPath = "",
}: {
  packagePath: string;
  renderPath?: string;
}) {
  const sdk = useSdk();
  const networkId = sdk.networks.getActive().id;
  const navigate = useNavigate();
  const [draftPackagePath, setDraftPackagePath] = useState(packagePath);

  useEffect(() => {
    setDraftPackagePath(packagePath);
  }, [packagePath]);

  const trailLabel = renderPath ? `${packagePath} (${renderPath})` : packagePath;
  useTrailRecorder({
    uri: `gno://${networkId}/realm/${packagePath}${renderPath ? `#${renderPath}` : ""}`,
    label: trailLabel,
  });

  const {
    data: nodes,
    error,
    isPending,
  } = useQuery({
    queryKey: ["realm-render", networkId, packagePath, renderPath],
    queryFn: async () => {
      const env = await sdk.rpc.queryRender(packagePath, renderPath, new Date().toISOString());
      return sdk.lenses.parseRender(env.data, packagePath);
    },
  });

  return (
    <div className="realm-browser">
      <form
        className="open-package-form"
        onSubmit={(e) => {
          e.preventDefault();
          void navigate({ to: "/", search: { pkg: draftPackagePath } });
        }}
      >
        <label>
          Realm path
          <input
            value={draftPackagePath}
            onChange={(e) => setDraftPackagePath(e.target.value)}
            placeholder="gno.land/r/sys/names"
          />
        </label>
        <button type="submit">Open</button>
      </form>
      {error ? (
        <p className="state-line" role="alert">
          Could not load this realm: {error.message}
        </p>
      ) : isPending ? (
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
  );
}

function RenderNodeView({ node }: { node: RenderNode }) {
  switch (node.type) {
    case "heading":
      return (
        <h2>
          <Linkified text={node.content ?? ""} />
        </h2>
      );
    case "code":
      return <pre>{node.content}</pre>;
    case "link":
      return <GnoLink node={node} />;
    case "paragraph":
      return (
        <p>
          {node.content !== undefined ? (
            <Linkified text={node.content} />
          ) : (
            node.children?.map((c, i) => <RenderNodeView key={i} node={c} />)
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

function GnoLink({ node }: { node: RenderNode }) {
  const navigate = useNavigate();

  if (node.ref?.packagePath) {
    const packagePath = node.ref.packagePath;
    const renderPath = node.renderPath ?? "";
    const search = renderPath ? { pkg: packagePath, path: renderPath } : { pkg: packagePath };
    return (
      <a
        href={`/?pkg=${encodeURIComponent(packagePath)}${renderPath ? `&path=${encodeURIComponent(renderPath)}` : ""}`}
        onClick={(e) => {
          e.preventDefault();
          void navigate({ to: "/", search });
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
