import { useSdk } from "../sdk-context";
import { useRealmImports } from "../use-realm-imports";
import { openInRealmTab } from "../shell/open-in-realm-tab";

// Direct dependencies only (spec §9.7's "imports"), parsed from source.
// Reverse references — what depends on THIS package — would need the
// indexer's graph, which isn't reachable from the browser (ADR-012/015).
export function RealmGraph({ packagePath, windowId }: { packagePath: string; windowId: string }) {
  const sdk = useSdk();
  const { data: imports, error, isPending } = useRealmImports(packagePath);

  if (error) {
    return (
      <p className="state-line" role="alert">
        Could not load dependencies: {error.message}
      </p>
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
        Reverse references (what depends on this package) aren&rsquo;t available — that needs the
        indexer, which isn&rsquo;t reachable from the browser yet.
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
