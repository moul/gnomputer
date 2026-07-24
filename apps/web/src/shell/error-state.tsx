/** A query's error state with a way to retry it — used instead of a bare
 * alert paragraph everywhere a failed fetch (dropped connection, RPC
 * hiccup, invalid path) would otherwise leave no way back except reloading
 * the whole page once whatever caused it clears up. */
export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <p className="state-line state-line--error" role="alert">
      {message}
      <button type="button" className="state-line__retry" onClick={onRetry}>
        Try again
      </button>
    </p>
  );
}
