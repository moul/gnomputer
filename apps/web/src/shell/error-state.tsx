import { describeError } from "./describe-error";

/** A query's error state with a way to retry it — used instead of a bare
 * alert paragraph everywhere a failed fetch (dropped connection, RPC
 * hiccup, invalid path) would otherwise leave no way back except reloading
 * the whole page once whatever caused it clears up. */
/** `message` is the context this view can supply ("Could not load source").
 * `error` is whatever was thrown; it is described rather than interpolated,
 * so a Go stack trace or "TypeError: Failed to fetch" never reaches the
 * screen as if it were an explanation (AUD-035). The full text stays in the
 * title attribute for anyone who wants it, and in the bug report. */
export function ErrorState({
  message,
  error,
  onRetry,
}: {
  message: string;
  error?: unknown;
  onRetry: () => void;
}) {
  const described = error === undefined ? null : describeError(error);
  return (
    <p
      className="state-line state-line--error"
      role="alert"
      title={described?.detail}
    >
      {described ? `${message}: ${described.message}` : message}
      <button type="button" className="state-line__retry" onClick={onRetry}>
        Try again
      </button>
    </p>
  );
}
