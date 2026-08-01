/** Same deadline the chain adapter uses. A hung third party shouldn't be
 * able to leave a panel spinning indefinitely just because it isn't the
 * chain. */
export const REMOTE_TIMEOUT_MS = 15_000;

export class RemoteContentError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = "RemoteContentError";
  }
}

/** Turns a rate-limited GitHub response into something a person can act on.
 *
 * Unauthenticated api.github.com allows 60 requests an hour per IP, and
 * exhausting it returns 403 — which rendered as a bare "403 Forbidden",
 * indistinguishable from a permissions problem and giving no hint that
 * waiting would fix it. */
function rateLimitMessage(response: Response): string | null {
  if (response.status !== 403 && response.status !== 429) return null;
  if (response.headers.get("x-ratelimit-remaining") !== "0") return null;

  const reset = Number(response.headers.get("x-ratelimit-reset"));
  if (!Number.isFinite(reset) || reset <= 0) {
    return "GitHub's rate limit for this network has been reached. Try again later.";
  }
  const minutes = Math.max(1, Math.ceil((reset * 1000 - Date.now()) / 60_000));
  return `GitHub's rate limit for this network has been reached. It resets in about ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

async function request(url: string, signal?: AbortSignal): Promise<Response> {
  // Composed, not replaced: replacing the caller's signal would silently
  // disable react-query's unmount cancellation, which is the same mistake
  // fetch-with-deadline exists to avoid in the chain adapter.
  const deadline = AbortSignal.timeout(REMOTE_TIMEOUT_MS);
  const combined = signal ? AbortSignal.any([signal, deadline]) : deadline;

  let response: Response;
  try {
    response = await fetch(url, { signal: combined });
  } catch (error) {
    if (signal?.aborted) throw error;
    if (deadline.aborted) {
      throw new RemoteContentError(`Timed out after ${REMOTE_TIMEOUT_MS / 1000}s fetching ${url}`);
    }
    throw new RemoteContentError(
      `Could not reach ${new URL(url).host}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (response.ok) return response;

  const limited = rateLimitMessage(response);
  if (limited) throw new RemoteContentError(limited, response.status);
  if (response.status === 404) {
    throw new RemoteContentError(`Not found: ${url}`, 404);
  }
  throw new RemoteContentError(`${response.status} ${response.statusText}`, response.status);
}

export async function fetchRemoteText(url: string, signal?: AbortSignal): Promise<string> {
  return (await request(url, signal)).text();
}

export async function fetchRemoteJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await request(url, signal);
  try {
    return (await response.json()) as T;
  } catch {
    throw new RemoteContentError(`${new URL(url).host} returned a response that isn't JSON`);
  }
}
