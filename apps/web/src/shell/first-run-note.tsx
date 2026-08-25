import { useEffect, useState } from "react";
import { useSdk } from "../sdk-context";
import { focusOrReopen, openRef } from "./open-ref";

/** Exported because retiring orphaned state has to set it: the keys it drops
 * are also what tells this note that someone has been here before. */
export const FIRST_RUN_DISMISSED_KEY = "first-run-note-dismissed";
const STORAGE_KEY = FIRST_RUN_DISMISSED_KEY;

/** Three things worth doing, rather than three things worth reading.
 *
 * The note used to say what the app is and stop there, which left a first
 * visitor looking at a windowed desktop with no obvious first move. Each of
 * these opens something that is demonstrably alive on a real chain within a
 * second or two — the point being made is "this is live", and a claim you
 * can click is worth more than a paragraph.
 *
 * Deliberately not a tour: no overlay, no step counter, nothing to escape
 * from. Picking one starts the app; ignoring them costs a click. */
const STARTERS = [
  {
    label: "Live governance",
    hint: "Real GovDAO proposals",
    run: () => openRef("gno://_/realm/gno.land/r/gov/dao"),
  },
  {
    label: "On-chain source",
    hint: "Gno read from the chain",
    run: () => openRef("gno://_/source-file/gno.land/r/sys/users"),
  },
  {
    label: "Live events",
    hint: "Watch blocks land",
    run: () => focusOrReopen("event-explorer"),
  },
];

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
      // "Has this person used the app before" is asked by prefix, not by one
      // key: the layout key carries a schema version and now a network id too,
      // so naming a single one goes stale silently. It already had — this read
      // `window-layout:home:v9` long after v10 shipped, so the check had been
      // answering "first visit" for everyone, and only the dismissal below was
      // still holding the note back.
      const [dismissed, layouts] = await Promise.all([
        sdk.uiState.get(STORAGE_KEY),
        sdk.uiState.keys("window-layout:"),
      ]);
      if (!cancelled && !dismissed && layouts.length === 0) setVisible(true);
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
      <ul className="first-run-note__starters">
        {STARTERS.map((starter) => (
          <li key={starter.label}>
            <button
              type="button"
              onClick={() => {
                starter.run();
                // Taking a starter IS starting — leaving the intro up over
                // the thing it just opened would be the note talking over
                // its own demonstration.
                dismiss();
              }}
            >
              <span className="first-run-note__starter-label">{starter.label}</span>
              <span className="first-run-note__starter-hint">{starter.hint}</span>
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="first-run-note__dismiss" onClick={dismiss}>
        Got it
      </button>
    </aside>
  );
}
