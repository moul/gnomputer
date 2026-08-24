import { useEffect, useRef, useState } from "react";
import { networkShortName } from "@gnomputer/app-sdk";
import { useSdk } from "../sdk-context";
import { useShellStore } from "../store";

/** How long the overlay stays up once the desktop is ready.
 *
 * Restoring a layout from IndexedDB is usually faster than a frame, so without
 * a floor the bar would appear and vanish as a flicker — which reads as a
 * glitch rather than as the machine changing chain. This is short enough not
 * to be a wait and long enough to be legible as one deliberate step. */
const MIN_VISIBLE_MS = 550;

/**
 * Covers the desktop while it is rebuilt for another chain.
 *
 * Switching network tears down every window and puts back the ones saved for
 * the network being switched to. That is a real teardown, so it is shown as
 * one: without it, windows blink out and back and the app looks broken at the
 * exact moment the user is least sure what happened.
 */
export function NetworkSwitchOverlay() {
  const sdk = useSdk();
  const switching = useShellStore((s) => s.networkSwitching);
  const switchSeq = useShellStore((s) => s.networkSwitchSeq);
  const [visible, setVisible] = useState(false);
  const shownAt = useRef(0);
  const seenSeq = useRef(switchSeq);

  // Shown off the counter, not off `networkSwitching`. Restoring a layout that
  // is already in the page cache can finish inside the same React batch that
  // started the switch, so a component watching only the boolean sees it go
  // true and back to false without ever rendering in between — and the overlay
  // silently never appears. The counter only ever increments, so a switch
  // cannot be missed that way.
  useEffect(() => {
    if (switchSeq === seenSeq.current) return;
    seenSeq.current = switchSeq;
    shownAt.current = Date.now();
    setVisible(true);
  }, [switchSeq]);

  useEffect(() => {
    if (!visible || switching) return;
    const remaining = MIN_VISIBLE_MS - (Date.now() - shownAt.current);
    if (remaining <= 0) {
      setVisible(false);
      return;
    }
    const timer = window.setTimeout(() => setVisible(false), remaining);
    return () => window.clearTimeout(timer);
  }, [switching, visible]);

  if (!visible) return null;

  const name = networkShortName(sdk.networks.getActive());

  return (
    // aria-live rather than a dialog: it is not asking anything and must not
    // trap focus — it is over in half a second, and stealing focus from
    // whatever the user was on would outlast the overlay itself.
    <div className="network-switch" role="status" aria-live="polite">
      <div className="network-switch__panel">
        <p className="network-switch__label">Switching to {name}</p>
        <div
          className="network-switch__bar"
          role="progressbar"
          aria-label={`Switching to ${name}`}
        >
          <span className="network-switch__bar-fill" />
        </div>
        <p className="network-switch__hint">Reopening this network&rsquo;s windows</p>
      </div>
    </div>
  );
}
