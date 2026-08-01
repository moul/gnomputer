import { useRegisterSW } from "virtual:pwa-register/react";

// Browsers already check for a byte-diff'd sw.js on every top-level
// navigation, but a tab that's never reloaded would otherwise only get
// checked roughly once a day — re-check periodically too so a long-lived
// tab still notices a deploy.
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

// How long to wait for a newly-activated worker to take control before
// reloading anyway. controllerchange normally fires in well under a second;
// this only exists so a wedged worker can't leave Refresh hanging forever.
const CONTROLLER_CHANGE_TIMEOUT_MS = 3000;

// Downloading + installing a new worker means re-fetching every precached
// asset, so this is far more generous than the controllerchange wait.
const INSTALL_TIMEOUT_MS = 15000;

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

function waitForControllerChange(): Promise<void> {
  return new Promise((resolve) => {
    const done = () => resolve();
    navigator.serviceWorker.addEventListener("controllerchange", done, { once: true });
    setTimeout(done, CONTROLLER_CHANGE_TIMEOUT_MS);
  });
}

/** `registration.update()` resolves as soon as the update *check* finishes,
 * while the newly-fetched worker is typically still in `installing` with
 * `registration.waiting` still null — verified directly in a browser:
 *
 *   before update(): installing=null   waiting=null      active=activated
 *   after  update(): installing=installing waiting=null  active=activated
 *   after  install : installing=null   waiting=installed active=activated
 *
 * Reading `.waiting` straight after `update()` therefore misses the new
 * worker entirely, which is what made the first attempt at this fix still
 * reload into the old build. Wait for the install to actually finish. */
function waitForInstalled(registration: ServiceWorkerRegistration): Promise<void> {
  const installing = registration.installing;
  if (!installing) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      installing.removeEventListener("statechange", onChange);
      resolve();
    };
    const onChange = () => {
      // "redundant" too: a worker that fails to install must not hang this.
      if (["installed", "activated", "redundant"].includes(installing.state)) done();
    };
    installing.addEventListener("statechange", onChange);
    setTimeout(done, INSTALL_TIMEOUT_MS);
  });
}

/** Loads the newly-deployed build for the case where version.json has
 * already noticed a deploy but the service worker hasn't been re-checked
 * yet — the exact window in which the old code's plain reload was served
 * the OLD build back out of the previous worker's precache, leaving the
 * update banner stuck on screen permanently.
 *
 * Forces an update check first, and if that turns up a waiting worker,
 * activates it and waits for it to take control before reloading. Falls
 * back to a plain reload when there's no service worker at all (dev, or a
 * browser with SW disabled) — correct there, since nothing is intercepting
 * the request. */
export async function activateNewVersionAndReload(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) {
      // The banner can appear before the browser has looked for a new
      // sw.js; ask explicitly rather than waiting for the 5-minute tick.
      await registration.update();
      await waitForInstalled(registration);
      const waiting = registration.waiting;
      if (waiting) {
        waiting.postMessage({ type: "SKIP_WAITING" });
        await waitForControllerChange();
      }
    }
  } catch {
    // A failed update check shouldn't strand the user on a banner they
    // can't dismiss — fall through to the reload below.
  }
  window.location.reload();
}
