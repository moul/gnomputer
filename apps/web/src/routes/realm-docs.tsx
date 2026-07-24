import { useRealmSymbols } from "../use-realm-symbols";
import { ErrorState } from "../shell/error-state";
import type { ExportedSymbol } from "@gnomputer/app-sdk";

// A godoc-style reference generated from the package's own source: every
// exported type and function, plus any doc comment immediately preceding it
// (spec §9.3). Most Gno source in the wild has few or no doc comments — the
// signature itself is still shown, same as godoc does for undocumented code.
export function RealmDocs({ packagePath }: { packagePath: string }) {
  const { data: symbols, error, isPending, refetch } = useRealmSymbols(packagePath);

  if (error) {
    return (
      <ErrorState
        message={`Could not load documentation: ${error.message}`}
        onRetry={() => void refetch()}
      />
    );
  }
  if (isPending || !symbols) {
    return (
      <p className="state-line" aria-busy="true">
        Reading source for exported symbols…
      </p>
    );
  }

  const types = symbols.filter((s) => s.kind === "type");
  const funcs = symbols.filter((s) => s.kind === "func");

  if (symbols.length === 0) {
    return <p className="state-line">No exported types or functions were found in this package.</p>;
  }

  return (
    <div className="realm-docs">
      {types.length > 0 && (
        <section>
          <h3>Types</h3>
          <ul className="realm-docs__list">
            {types.map((s) => (
              <SymbolEntry key={`${s.file}:${s.name}`} symbol={s} />
            ))}
          </ul>
        </section>
      )}
      {funcs.length > 0 && (
        <section>
          <h3>Functions</h3>
          <ul className="realm-docs__list">
            {funcs.map((s) => (
              <SymbolEntry key={`${s.file}:${s.name}`} symbol={s} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function SymbolEntry({ symbol }: { symbol: ExportedSymbol }) {
  return (
    <li className="realm-docs__item">
      <code>{symbol.signature}</code>
      {symbol.doc.length > 0 && <p className="realm-docs__doc">{symbol.doc.join(" ")}</p>}
      <span className="realm-docs__file">{symbol.file}</span>
    </li>
  );
}
