import { useEffect, useState } from "react";
import { useSdk } from "../sdk-context";

const STORAGE_KEY = "first-run-note-dismissed";

/** The opening text from the spec (§7.1), which was missing entirely.
 *
 * A first visit landed on a windowed desktop with icon-only chrome and no
 * statement of what any of it is. The spec asks for one line saying what
 * you are looking at and one saying what to do with it — no modal, no
 * carousel, no wallet prompt (AUD-009).
 *
 * It sits under the island rather than over the desktop so it can't cover a
 * window, and it disappears for good once dismissed. Anyone who has used
 * the app before never sees it: a stored window layout means this isn't a
 * first run, and dismissal is remembered besides. */
export function FirstRunNote() {
  const sdk = useSdk();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [dismissed, layout] = await Promise.all([
        sdk.uiState.get(STORAGE_KEY),
        sdk.uiState.get("window-layout:home:v9"),
      ]);
      if (!cancelled && !dismissed && !layout) setVisible(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [sdk]);

  // Gets out of the way as soon as you start using the app. Without this it
  // sat there over the workspace until explicitly dismissed — and an e2e
  // caught it swallowing a click on a button underneath, which is exactly
  // what it would have done to a real person.
  useEffect(() => {
    if (!visible) return;
    function onPointerDown(event: PointerEvent) {
      if ((event.target as HTMLElement | null)?.closest(".first-run-note")) return;
      setVisible(false);
      void sdk.uiState.set(STORAGE_KEY, "1");
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [visible, sdk]);

  if (!visible) return null;

  function dismiss() {
    setVisible(false);
    void sdk.uiState.set(STORAGE_KEY, "1");
  }

  return (
    <aside className="first-run-note">
      <p className="first-run-note__lead">You are browsing the shared computer.</p>
      <p className="first-run-note__body">
        Open any program, user, function or transaction to follow it through the world. Everything
        here is live chain data, read-only, and no wallet is needed.
      </p>
      <button type="button" className="first-run-note__dismiss" onClick={dismiss}>
        Got it
      </button>
    </aside>
  );
}
