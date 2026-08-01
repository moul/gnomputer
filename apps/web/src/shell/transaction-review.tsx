import { formatUgnotString } from "../format-number";
import type { IntentPhase } from "./transaction-intent";
import type { WalletAccount } from "./wallet-store";
import { useFocusTrap } from "./use-focus-trap";

/** The human-readable review that must appear before any signature request,
 * and the lifecycle afterwards.
 *
 * Registration previously submitted straight to the wallet and then just
 * cleared the form — no review, and "done" meant only that the wallet
 * returned success, which is acceptance, not on-chain confirmation
 * (AUD-001/003, #92). */
export function TransactionReview({
  state,
  account,
  networkChainId,
  explorerTxUrl,
  onConfirm,
  onCancel,
  onDismiss,
}: {
  state: IntentPhase;
  account: WalletAccount;
  networkChainId: string;
  explorerTxUrl?: (hash: string) => string;
  onConfirm: () => void;
  onCancel: () => void;
  onDismiss: () => void;
}) {
  const trapRef = useFocusTrap<HTMLDivElement>(state.phase !== "idle");

  if (state.phase === "idle") return null;

  const { intent } = state;
  const busy = state.phase === "signing" || state.phase === "submitted";

  return (
    <div
      ref={trapRef}
      className="tx-review"
      role="dialog"
      aria-modal="true"
      aria-label="Review transaction"
    >
      <div className="tx-review__panel">
        <p className="tx-review__summary">{intent.summary}</p>

        <dl className="tx-review__facts">
          <dt>Chain</dt>
          <dd>{networkChainId}</dd>
          <dt>Account</dt>
          <dd className="tx-review__mono">{account.address}</dd>
          <dt>Realm</dt>
          <dd className="tx-review__mono">{intent.packagePath}</dd>
          <dt>Function</dt>
          <dd className="tx-review__mono">
            {intent.func}({intent.args.join(", ")})
          </dd>
          <dt>Sending</dt>
          <dd data-emphasis={intent.send ? "true" : undefined}>
            {intent.send ? formatUgnotString(intent.send) : "Nothing"}
            {intent.send && intent.sendReason ? ` — ${intent.sendReason}` : ""}
          </dd>
        </dl>

        {state.phase === "review" && (
          <p className="tx-review__note">
            Your wallet will ask you to sign. Gnomputer never sees your keys, and can&rsquo;t submit
            anything you don&rsquo;t approve there too.
          </p>
        )}

        {state.phase === "signing" && (
          <p className="tx-review__status" role="status">
            Waiting for you to approve this in your wallet…
          </p>
        )}

        {state.phase === "submitted" && (
          <p className="tx-review__status" role="status">
            Submitted — waiting for it to be included in a block…
            {state.hash && explorerTxUrl && (
              <>
                {" "}
                <a href={explorerTxUrl(state.hash)} target="_blank" rel="noopener noreferrer">
                  View transaction ↗
                </a>
              </>
            )}
          </p>
        )}

        {state.phase === "confirmed" && (
          <p className="tx-review__status" data-ok="true" role="status">
            Confirmed on chain.
            {state.hash && explorerTxUrl && (
              <>
                {" "}
                <a href={explorerTxUrl(state.hash)} target="_blank" rel="noopener noreferrer">
                  View transaction ↗
                </a>
              </>
            )}
          </p>
        )}

        {state.phase === "failed" && (
          <p className="tx-review__status" data-error="true" role="alert">
            {state.error}
          </p>
        )}

        <div className="tx-review__actions">
          {state.phase === "review" && (
            <>
              <button type="button" className="tx-review__confirm" onClick={onConfirm}>
                Approve in wallet…
              </button>
              <button type="button" onClick={onCancel}>
                Cancel
              </button>
            </>
          )}
          {(state.phase === "confirmed" || state.phase === "failed") && (
            <button type="button" onClick={onDismiss}>
              Close
            </button>
          )}
          {busy && (
            <button type="button" disabled>
              Working…
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
