import { useEffect } from "react";
import { useSdk } from "../sdk-context";
import { FIRST_RUN_DISMISSED_KEY } from "./first-run-note";

/**
 * Keys nothing reads any more, dropped once on load.
 *
 * Both were global before realm tabs and the desktop layout became per-network
 * (`realm-tabs:<networkId>`, `window-layout:home:v10:<networkId>`). They were
 * deliberately not migrated: attributing one session's open windows to a chain
 * they may not have belonged to is worse than losing them. But leaving them
 * there means the Storage tab counts bytes nobody will ever read again, and
 * the next person greps a key that looks live and is not.
 *
 * Listed explicitly rather than matched by prefix, so this can never eat a key
 * that is still in use — `window-layout:home:v10:sapphire` starts with the
 * retired `window-layout:home:v10`.
 */
const RETIRED_KEYS = ["realm-tabs", "window-layout:home:v10", "window-layout:home:v9"];

/** Drops state that a schema change orphaned. Safe to run on every load: it
 * removes nothing once the keys are gone. */
export function useRetireOrphanedState() {
  const sdk = useSdk();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const present = await sdk.uiState.keys();
      if (cancelled) return;
      const orphaned = RETIRED_KEYS.filter((key) => present.includes(key));
      if (orphaned.length === 0) return;

      // These keys are also what tells the first-run note that someone has been
      // here before. Deleting them without recording that would greet a
      // returning user as new — and which of the two effects runs first is not
      // something to depend on, so the fact is written down before the
      // evidence goes.
      if (orphaned.some((key) => key.startsWith("window-layout:"))) {
        await sdk.uiState.set(FIRST_RUN_DISMISSED_KEY, "1");
      }
      if (cancelled) return;
      await Promise.all(orphaned.map((key) => sdk.uiState.remove(key)));
    })();
    return () => {
      cancelled = true;
    };
  }, [sdk]);
}

export { RETIRED_KEYS };
