import { useSdk } from "../sdk-context";
import { useRealmImports } from "../use-realm-imports";
import { openInRealmTab } from "../shell/open-in-realm-tab";
import { ErrorState } from "../shell/error-state";

// mygnoscan's dependency graph (confirmed live: a real SVG graph including
// REVERSE references, something this app can't produce on its own — that
// needs the indexer's full graph, not reachable from the browser,
// ADR-012/015) — its own path convention is /realm/<path without the
// "gno.land/" prefix>, confirmed via mygnoscan's own router (path.slice(7)
// then re-prepending "gno.land/"), with ?tab=graph landing straight on it.
function mygnoscanGraphUrl(explorerUrl: string, packagePath: string): string {
  return `${explorerUrl}/realm/${packagePath.replace(/^gno\.land\//, "")}?tab=graph`;
}

// Local-imports fallback for networks with no configured explorerUrl (e.g.
// gnodev) — direct dependencies only (spec §9.7's "imports"), parsed from
// source. No reverse references without the indexer, same limitation
// mygnoscan's embed exists to route around.
function LocalImportsGraph({ packagePath, windowId }: { packagePath: string; windowId: string }) {
  const sdk = useSdk();
  const { data: imports, error, isPending, refetch } = useRealmImports(packagePath);

  if (error) {
    return (
      <ErrorState
        message={`Could not load dependencies: ${error.message}`}
        onRetry={() => void refetch()}
      />
    );
  }
  if (isPending || !imports) {
    return (
      <p className="state-line" aria-busy="true">
        Reading source for imports…
      </p>
    );
  }

  const chainImports = imports.filter((imp) => sdk.lenses.isChainPackage(imp.path));
  const stdlibImports = imports.filter((imp) => !sdk.lenses.isChainPackage(imp.path));

  return (
    <div className="realm-graph">
      <p className="state-line">
        No explorer configured for this network — showing direct dependencies only (parsed from
        source). Reverse references need the indexer, not reachable from the browser.
      </p>
      {imports.length === 0 ? (
        <p className="state-line">No imports found.</p>
      ) : (
        <>
          {chainImports.length > 0 && (
            <section>
              <h3>Gno packages</h3>
              <ul className="realm-graph__list">
                {chainImports.map((imp) => (
                  <li key={imp.path}>
                    <button type="button" onClick={() => openInRealmTab(windowId, { packagePath: imp.path })}>
                      {imp.path}
                    </button>
                    {imp.alias && <span className="realm-graph__alias">as {imp.alias}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {stdlibImports.length > 0 && (
            <section>
              <h3>Standard library</h3>
              <ul className="realm-graph__list realm-graph__list--plain">
                {stdlibImports.map((imp) => (
                  <li key={imp.path}>{imp.path}</li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

export function RealmGraph({ packagePath, windowId }: { packagePath: string; windowId: string }) {
  const sdk = useSdk();
  const explorerUrl = sdk.networks.getActive().explorerUrl;

  if (!explorerUrl) {
    return <LocalImportsGraph packagePath={packagePath} windowId={windowId} />;
  }

  const graphUrl = mygnoscanGraphUrl(explorerUrl, packagePath);
  return (
    <div className="realm-graph realm-graph--embed">
      <div className="realm-graph__embed-toolbar">
        <a
          className="realm-browser__gnoweb-link"
          href={graphUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open in mygnoscan ↗
        </a>
      </div>
      <iframe className="realm-graph__embed-frame" src={graphUrl} title={`${packagePath} dependency graph`} />
    </div>
  );
}
