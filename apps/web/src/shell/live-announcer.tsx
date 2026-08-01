/** A polite live region.
 *
 * Nothing in the shell had an `aria-live` region at all, so state conveyed
 * purely by colour — the connection dot in particular — was completely
 * silent to a screen reader (AUD-018). The dot is `aria-hidden` and the
 * trigger's accessible name is only read when it happens to be focused, so a
 * chain that dropped mid-session was simply never mentioned.
 *
 * This component deliberately holds no policy about *when* something is
 * worth saying — see `connection-announcement.ts` for that. It exists so
 * that the markup a live region needs is written correctly in one place. */
export function LiveAnnouncer({ message }: { message: string }) {
  return (
    <span className="visually-hidden" role="status" aria-live="polite">
      {message}
    </span>
  );
}
