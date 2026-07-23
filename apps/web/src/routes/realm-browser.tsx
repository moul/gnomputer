import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useSdk } from "../sdk-context";
import { useTrailRecorder } from "../use-trail-recorder";
import { Linkified } from "../shell/linkify";
import { Freshness } from "../shell/freshness";
import type { RenderNode } from "@gnomputer/lenses";

const STAFF_PICKS = [
  { label: "Users", packagePath: "gno.land/r/sys/users" },
  { label: "Boards2", packagePath: "gno.land/r/gnoland/boards2" },
  { label: "Blog", packagePath: "gno.land/r/gnoland/blog" },
  { label: "GovDAO", packagePath: "gno.land/r/gov/dao" },
];

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
  const hasPackage = packagePath !== "";

  useEffect(() => {
    setDraftPackagePath(packagePath);
  }, [packagePath]);

  const trailLabel = renderPath ? `${packagePath} (${renderPath})` : packagePath;
  useTrailRecorder(
    {
      uri: `gno://${networkId}/realm/${packagePath}${renderPath ? `#${renderPath}` : ""}`,
      label: trailLabel,
    },
    hasPackage
  );

  const {
    data: nodes,
    error,
    isPending,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ["realm-render", networkId, packagePath, renderPath],
    queryFn: async () => {
      const env = await sdk.rpc.queryRender(packagePath, renderPath, new Date().toISOString());
      return sdk.lenses.parseRender(env.data, packagePath);
    },
    enabled: hasPackage,
  });

  function openPackage(pkg: string) {
    void navigate({ to: "/", search: { pkg } });
  }

  return (
    <div className="realm-browser">
      <form
        className="open-package-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (draftPackagePath === "") return;
          openPackage(draftPackagePath);
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
        {hasPackage && (
          <button type="button" onClick={() => void navigate({ to: "/", search: {} })}>
            🏠 Home
          </button>
        )}
      </form>
      {!hasPackage ? (
        <RealmBrowserHome onOpen={openPackage} />
      ) : error ? (
        <p className="state-line" role="alert">
          Could not load this realm: {error.message}
        </p>
      ) : isPending ? (
        <p className="state-line" aria-busy="true">
          Loading realm…
        </p>
      ) : (
        <>
          <Freshness dataUpdatedAt={dataUpdatedAt} />
          <article aria-label={`Realm ${packagePath}`}>
            {nodes.map((node, i) => (
              <RenderNodeView key={i} node={node} />
            ))}
          </article>
        </>
      )}
    </div>
  );
}

function RealmBrowserHome({ onOpen }: { onOpen: (packagePath: string) => void }) {
  const sdk = useSdk();
  const {
    data: realms,
    error,
    isPending,
  } = useQuery({
    queryKey: ["realm-list", sdk.networks.getActive().id],
    queryFn: async () => (await sdk.indexer.listRealms()).data,
    retry: false,
  });

  return (
    <div className="realm-browser-home">
      <section>
        <h3>Staff picks</h3>
        <ul className="realm-browser-home__list">
          {STAFF_PICKS.map((pick) => (
            <li key={pick.packagePath}>
              <button type="button" onClick={() => onOpen(pick.packagePath)}>
                {pick.label}
                <span className="realm-browser-home__path">{pick.packagePath}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3>Community realms</h3>
        {error ? (
          <p className="state-line" role="alert">
            Realm discovery isn't reachable from the browser on this network right now — the
            indexer doesn't allow direct browser access yet. Try Staff Picks above, or open a
            realm path directly.
          </p>
        ) : isPending ? (
          <p className="state-line" aria-busy="true">
            Discovering deployed realms…
          </p>
        ) : realms.length === 0 ? (
          <p className="state-line">No other realms discovered on this network yet.</p>
        ) : (
          <ul className="realm-browser-home__list">
            {realms.map((realm) => (
              <li key={realm.packagePath}>
                <button type="button" onClick={() => onOpen(realm.packagePath)}>
                  {realm.packagePath}
                  <span className="realm-browser-home__path">deployed at #{realm.blockHeight}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
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
