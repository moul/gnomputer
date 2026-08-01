/** The placeholder a live feed shows before its first data arrives.
 *
 * The live hooks catch every error and retry forever, which is right for a
 * transient hiccup but meant a genuinely unreachable endpoint sat on
 * "Watching the chain…" indefinitely — indistinguishable from a quiet chain
 * (AUD-025). When the shared height query is failing, say so instead. */
export function LiveFeedStatus({ isError, watching }: { isError: boolean; watching: string }) {
  if (isError) {
    return (
      <p className="state-line" data-error="true" role="status">
        Can&rsquo;t reach the chain right now — still retrying. Anything already loaded stays
        visible.
      </p>
    );
  }
  return (
    <p className="state-line" aria-busy="true">
      {watching}
    </p>
  );
}
