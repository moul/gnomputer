import { useEffect, useRef, useState } from "react";
import { copyText, prefersNativeShare } from "./copy-text";

type State = "idle" | "copied" | "failed";

/** Copies the current URL, which already carries the realm, the lens and
 * the network (#139).
 *
 * The README has promised shareable links for a while and they worked —
 * but the only way to get one was to select the browser's address bar. In
 * the installed PWA there IS no address bar, so on the platform the app
 * most wants you to install it to, the feature was unreachable.
 *
 * Reports failure rather than claiming success. A clipboard write can be
 * refused (insecure origin, unfocused document, denied permission) and
 * "Copied!" over a clipboard that still holds something else sends the
 * wrong link to whoever you paste it for. */
export function ShareLinkButton({ label = "this view" }: { label?: string }) {
  const [state, setState] = useState<State>("idle");
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    []
  );

  function flash(next: State) {
    setState(next);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 2200);
  }

  async function share() {
    const url = window.location.href;
    if (prefersNativeShare()) {
      try {
        await navigator.share({ url, title: document.title });
        return; // The sheet is its own confirmation; a toast would double it.
      } catch {
        // Dismissing the sheet rejects too, so fall through to the
        // clipboard rather than reporting a failure the user caused.
      }
    }
    flash((await copyText(url)) ? "copied" : "failed");
  }

  const title =
    state === "copied"
      ? "Link copied"
      : state === "failed"
        ? "Could not copy — select the address bar instead"
        : `Copy a link to ${label}`;

  return (
    <button
      type="button"
      className="share-link-button"
      data-state={state}
      aria-label={title}
      title={title}
      onClick={() => void share()}
    >
      <span aria-hidden="true">{state === "copied" ? "✓" : state === "failed" ? "!" : "🔗"}</span>
      {/* Announced, not painted: the icon carries the state visually, and a
          width that changes on click would nudge the whole toolbar. */}
      <span className="visually-hidden" role="status">
        {state === "copied" ? "Link copied" : state === "failed" ? "Could not copy the link" : ""}
      </span>
    </button>
  );
}
