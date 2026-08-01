export type AnnounceableState = "connecting" | "connected" | "error" | "offline";

/** What, if anything, a screen reader should be told about the connection.
 *
 * The tempting rule — "announce every state change" — is wrong at both ends.
 * The clock boots in `connecting` and settles a moment later, so announcing
 * changes would open every single page load by reading out "Connected to the
 * chain", which is noise rather than news. Equally, staying silent until a
 * *transition* would mean a user who loads the page while the chain is
 * already down hears nothing at all — and they cannot see the red dot that
 * is the only other signal.
 *
 * So: `connecting` is never spoken, a problem is always spoken (including on
 * arrival), and recovery is spoken only if a problem was announced first.
 *
 * Returns the new announcement plus the carried-forward `hadProblem` flag,
 * or `null` when nothing should change — a re-render must not clear and
 * respeak a message that still holds. */
export function connectionAnnouncement(
  state: AnnounceableState,
  hadProblem: boolean
): { message: string; hadProblem: boolean } | null {
  if (state === "connecting") return null;

  if (state === "connected") {
    if (!hadProblem) return null;
    return { message: "Connection to the chain restored.", hadProblem: false };
  }

  if (hadProblem) return null;
  return {
    message:
      state === "offline"
        ? "You are offline. Already-loaded content keeps working."
        : "Not connected to the chain. Live updates have stopped.",
    hadProblem: true,
  };
}
