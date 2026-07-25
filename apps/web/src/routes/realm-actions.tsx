import { useState } from "react";
import { useSdk } from "../sdk-context";
import { useRealmSymbols } from "../use-realm-symbols";
import { ErrorState } from "../shell/error-state";
import { gnowebTxLink } from "../shell/gnoweb-links";
import { QrCode } from "../shell/qr-code";

// The realm's mutating entrypoints (spec §9.6) — a func whose first
// parameter is `realm` (e.g. `_ realm`, `cur realm`) is Gno's own convention
// for a callable, state-changing action. Calling one for real needs a
// signed transaction; rather than re-implement a generic Gno-argument
// input form here, each action links to gnoweb's own real call form via a
// GnoConnect TxLink ($help&func=<Name> — confirmed live: it jumps straight
// to that function, narrowing the page's own function list to just it),
// where gnoweb's existing UI already handles arbitrary parameter types.
export function RealmActions({ packagePath }: { packagePath: string }) {
  const sdk = useSdk();
  const gnowebUrl = sdk.networks.getActive().gnowebUrl;
  const { data: symbols, error, isPending, refetch } = useRealmSymbols(packagePath);
  const [qrOpenFor, setQrOpenFor] = useState<string | null>(null);

  if (error) {
    return (
      <ErrorState message={`Could not load actions: ${error.message}`} onRetry={() => void refetch()} />
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
      {gnowebUrl ? (
        <p className="state-line">
          Each action links to gnoweb&rsquo;s own call form, pre-selected to that function — gnoweb
          handles signing (via a connected wallet or gnokey).
        </p>
      ) : (
        <p className="state-line">
          No gnoweb URL configured for this network — actions are listed read-only.
        </p>
      )}
      {actions.length === 0 ? (
        <p className="state-line">No realm-mutating functions were found in this package.</p>
      ) : (
        <ul className="realm-actions__list">
          {actions.map((a) => {
            const key = `${a.file}:${a.name}`;
            const txLink = gnowebUrl ? gnowebTxLink(gnowebUrl, packagePath, a.name) : null;
            return (
              <li key={key} className="realm-actions__item">
                <code>{a.signature}</code>
                {a.doc.length > 0 && <p className="realm-actions__doc">{a.doc.join(" ")}</p>}
                <div className="realm-actions__footer">
                  <span className="realm-actions__file">{a.file}</span>
                  {txLink ? (
                    <div className="realm-actions__links">
                      <a
                        className="realm-actions__call-link"
                        href={txLink}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Call on gnoweb ↗
                      </a>
                      <button
                        type="button"
                        className="realm-actions__qr-toggle"
                        aria-expanded={qrOpenFor === key}
                        onClick={() => setQrOpenFor(qrOpenFor === key ? null : key)}
                      >
                        {qrOpenFor === key ? "Hide QR" : "QR"}
                      </button>
                    </div>
                  ) : (
                    <button type="button" disabled title="No gnoweb URL configured for this network">
                      Call…
                    </button>
                  )}
                </div>
                {txLink && qrOpenFor === key && (
                  <div className="realm-actions__qr">
                    <QrCode value={txLink} size={140} />
                    <p className="state-line">Scan to open this action&rsquo;s call form on another device.</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
