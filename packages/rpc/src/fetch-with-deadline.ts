/** Every direct fetch in this package previously had no timeout and no
 * cancellation, so a hung endpoint left the caller's promise pending
 * forever — a view stuck on "Loading…" with no error and no retry, and (for
 * the polling hooks) a tick that never completed (AUD-023).
 *
 * `AbortSignal.timeout` is the whole mechanism; this wrapper exists so the
 * deadline is applied consistently and the resulting error says something
 * a user can act on rather than surfacing a bare "AbortError". */
export const DEFAULT_TIMEOUT_MS = 15_000;

export class RequestTimeoutError extends Error {
  constructor(url: string, ms: number) {
    super(`Request to ${new URL(url).host} timed out after ${Math.round(ms / 1000)}s.`);
    this.name = "RequestTimeoutError";
  }
}

export async function fetchWithDeadline(
  url: string,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  // Compose with any signal the caller already passed (e.g. react-query's
  // own cancellation) rather than overwriting it — dropping theirs would
  // silently disable unmount cancellation.
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;

  try {
    return await fetch(url, { ...init, signal });
  } catch (e) {
    // Distinguish "we gave up waiting" from "the caller cancelled" and from
    // a genuine transport failure — they mean different things to the UI.
    if (timeout.aborted) throw new RequestTimeoutError(url, timeoutMs);
    throw e;
  }
}
