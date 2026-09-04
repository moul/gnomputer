import { IndexerRequestError } from "@gnomputer/app-sdk";

/** Classifies a chain RPC/indexer failure as something the UI can act on,
 * shared between the error banner (describe-error.ts) and the island's
 * live-status badge (island-status.tsx / use-chain-height.ts) so both agree
 * on what "rate limited" means instead of drifting into two regexes.
 *
 * A CORS-blocked rate-limit response reaches `fetch()` as an opaque "Failed
 * to fetch" — the browser refuses to expose the status at all — so
 * "unreachable" is the honest label for that case, not "rate limited": it is
 * unmeasured whether the public RPC/indexer's rate limiter sends CORS
 * headers on its 429 (issue #218). Only a status that DID come through
 * (the indexer's typed 429, or Tendermint2's own "Bad status on response:
 * 429" wording) is confidently labelled rate-limited.
 */
export type ChainErrorKind = "rate-limited" | "unreachable" | null;

const BAD_STATUS = /bad status on response:\s*(\d{3})/i;
const OPAQUE_FETCH_FAILURE = /failed to fetch|networkerror|load failed/i;

export function classifyChainError(error: unknown): ChainErrorKind {
  if (error === null || error === undefined) return null;

  if (error instanceof IndexerRequestError) {
    return error.status === 429 ? "rate-limited" : null;
  }

  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "";

  const badStatus = raw.match(BAD_STATUS);
  if (badStatus) return badStatus[1] === "429" ? "rate-limited" : null;

  if (OPAQUE_FETCH_FAILURE.test(raw)) return "unreachable";

  return null;
}
