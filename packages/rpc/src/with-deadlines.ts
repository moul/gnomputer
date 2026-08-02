import { DEFAULT_TIMEOUT_MS, RequestTimeoutError } from "./fetch-with-deadline";

/** Puts a deadline on every async method of a connected chain client.
 *
 * fetchWithDeadline covers the raw fetches in this package, but the
 * Tm2Client and JSONRPCProvider from @gnolang/tm2-js-client use their own
 * transport and honour no timeout at all. That left most chain calls —
 * status, blocks, accounts, the validator set — able to hang indefinitely.
 *
 * Measured before this: with an endpoint that accepts the connection and
 * never answers, the app sat at "connecting" for 30s with no error, no
 * retry and exactly one request outstanding. Not a crash, which is worse:
 * a spinner that never resolves gives no reason to suspect the endpoint
 * rather than the app (AUD-023, and the same failure-path gap as the
 * memoized-rejection bug in client.ts).
 *
 * A Proxy rather than a wrapper per method, deliberately: the client
 * surface is wide and grows, and a method added later would silently miss
 * an opt-in list. Only promise-returning methods are wrapped; anything else
 * passes through untouched.
 *
 * The underlying request is NOT cancelled — the library gives no handle to
 * cancel it. The caller stops waiting, which is what unsticks the UI; the
 * orphaned request completes into nothing.
 */
/** Rejects with RequestTimeoutError if `promise` has not settled in time.
 * The underlying work is not cancelled — the library exposes no handle for
 * that — but the caller stops waiting, which is what unsticks the UI. */
export function withDeadline<T>(promise: Promise<T>, host: string, ms = DEFAULT_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new RequestTimeoutError(host, ms)), ms);
  });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

export function withDeadlines<T extends object>(target: T, host: string, ms = DEFAULT_TIMEOUT_MS): T {
  return new Proxy(target, {
    get(object, property, receiver) {
      const value = Reflect.get(object, property, receiver) as unknown;
      if (typeof value !== "function") return value;

      return (...args: unknown[]) => {
        const result = (value as (...a: unknown[]) => unknown).apply(object, args);
        if (!(result instanceof Promise)) return result;

        return withDeadline(result, host, ms);
      };
    },
  });
}
