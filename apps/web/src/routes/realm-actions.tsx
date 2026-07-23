import { useRealmSymbols } from "../use-realm-symbols";

// The realm's mutating entrypoints (spec §9.6) — a func whose first
// parameter is `realm` (e.g. `_ realm`, `cur realm`) is Gno's own convention
// for a callable, state-changing action. Listed read-only: calling one for
// real needs a signed transaction, which needs a connected wallet — not
// available yet (browsing as guest), same gap as the Settings > User tab's
// disabled Connect button.
export function RealmActions({ packagePath }: { packagePath: string }) {
  const { data: symbols, error, isPending } = useRealmSymbols(packagePath);

  if (error) {
    return (
      <p className="state-line" role="alert">
        Could not load actions: {error.message}
      </p>
    );
  }
  if (isPending || !symbols) {
    return (
      <p className="state-line" aria-busy="true">
        Reading source for callable functions…
      </p>
    );
  }

  const actions = symbols.filter((s) => s.kind === "func" && s.isRealmAction);

  return (
    <div className="realm-actions">
      <p className="state-line">
        Calling one of these requires a connected wallet, which isn&rsquo;t available yet.
      </p>
      {actions.length === 0 ? (
        <p className="state-line">No realm-mutating functions were found in this package.</p>
      ) : (
        <ul className="realm-actions__list">
          {actions.map((a) => (
            <li key={`${a.file}:${a.name}`} className="realm-actions__item">
              <code>{a.signature}</code>
              {a.doc.length > 0 && <p className="realm-actions__doc">{a.doc.join(" ")}</p>}
              <div className="realm-actions__footer">
                <span className="realm-actions__file">{a.file}</span>
                <button type="button" disabled title="Wallet connection isn't available yet">
                  Call…
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
