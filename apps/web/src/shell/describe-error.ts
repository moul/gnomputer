/** Longest message worth putting in front of someone. Past this the text
 * stops being an explanation and becomes a wall. */
const MAX_LENGTH = 240;

/** Markers that identify a Gno VM error carrying a Go stack trace. The RPC
 * adapter already extracts the human part of the common shape; this catches
 * the ones it cannot, so a stack never reaches the screen by default. */
const STACK_MARKERS = ["--- preprocess stack ---", "--- stack trace ---", "goroutine "];

export interface DescribedError {
  /** What to show. One line, no stack, bounded length. */
  message: string;
  /** The original text, kept for the bug report. Not rendered. */
  detail: string;
}

/** Turns whatever a query threw into something worth reading.
 *
 * Views interpolated raw `error.message` straight into the UI. For the
 * errors this codebase raises itself that is fine — they are written to be
 * read. For the ones it does not, it meant Go stack traces, multi-line
 * preprocessor dumps, and "TypeError: Failed to fetch" appearing as if they
 * were an explanation (AUD-035).
 *
 * The full text is not discarded, only separated: `detail` is what the bug
 * report attaches, `message` is what the screen shows. */
export function describeError(error: unknown): DescribedError {
  if (error === null || error === undefined) {
    return { message: "Something went wrong.", detail: String(error) };
  }

  const raw = error instanceof Error ? error.message : String(error);
  const detail = error instanceof Error && error.stack ? error.stack : raw;

  // A thrown non-Error is a programming mistake somewhere; its stringified
  // form ("[object Object]") explains nothing.
  if (!(error instanceof Error) && typeof error !== "string") {
    return { message: "Something went wrong.", detail };
  }

  if (raw.trim() === "") return { message: "Something went wrong.", detail };

  // Browsers give the same opaque message for a dropped connection, a DNS
  // failure, a CORS rejection and a blocked mixed-content request. Saying
  // which is impossible from script; saying what to try is not.
  if (/failed to fetch|networkerror|load failed/i.test(raw)) {
    return {
      message: "Could not reach the network. Check your connection and try again.",
      detail,
    };
  }

  let message = raw;
  const marker = STACK_MARKERS.find((m) => message.includes(m));
  if (marker) message = message.slice(0, message.indexOf(marker));

  // Even without a recognised marker, only the first line of a multi-line
  // error is ever the explanation.
  message = message.split("\n")[0]!.trim();
  if (message === "") message = "Something went wrong.";

  if (message.length > MAX_LENGTH) message = `${message.slice(0, MAX_LENGTH - 1).trimEnd()}…`;

  return { message, detail };
}
