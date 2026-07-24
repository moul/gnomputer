import { useRegisterSW } from "virtual:pwa-register/react";

// Browsers already check for a byte-diff'd sw.js on every top-level
// navigation, but a tab that's never reloaded would otherwise only get
// checked roughly once a day — re-check periodically too so a long-lived
// tab still notices a deploy.
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

/** Registers the service worker (replacing vite-plugin-pwa's own naive
 * auto-injected script — see vite.config.ts's injectRegister: false) and
 * exposes whether a new one is waiting to take over.
 *
 * updateServiceWorker() is the reason this exists rather than a plain
 * `window.location.reload()`: it posts skipWaiting to the waiting worker,
 * waits for the controllerchange event, and only THEN reloads — a plain
 * reload can still be served by the OLD worker (still "active" at the
 * moment that reload's own fetch happens), silently requiring a second
 * manual reload to actually see the new version. */
export function useSwUpdate() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      setInterval(() => void registration.update(), CHECK_INTERVAL_MS);
    },
  });

  return { needRefresh, updateServiceWorker };
}
