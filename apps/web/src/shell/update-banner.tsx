import { useState } from "react";
import { useVersionCheck } from "./use-version-check";
import { useSwUpdate, activateNewVersionAndReload } from "./use-sw-update";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// The changelog is organized by date (## YYYY-MM-DD headings — GitHub
// slugifies those to an identical #YYYY-MM-DD anchor, no letters to
// lowercase), one section per day changes shipped — so the new build's own
// date is always a valid deep link, as long as that convention is kept up.
function changelogUrl(buildTimeIso: string): string {
  return `${__GIT_REPO__}/blob/main/CHANGELOG.md#${buildTimeIso.slice(0, 10)}`;
}

export function UpdateBanner() {
  const newVersion = useVersionCheck();
  const { needRefresh, updateServiceWorker } = useSwUpdate();
  const [busy, setBusy] = useState(false);

  if (!newVersion && !needRefresh) return null;

  async function refresh() {
    if (busy) return;
    setBusy(true);
    // needRefresh means a new service worker is already installed and
    // waiting — updateServiceWorker(true) tells it to take over and waits
    // for that before reloading.
    //
    // Otherwise the banner is here because version.json (which bypasses the
    // service worker entirely) spotted a deploy the worker hasn't noticed
    // yet. A plain reload in that window gets served the OLD build straight
    // back out of the current worker's precache — the tab never updates and
    // this banner reappears, which is exactly the "Refresh does nothing"
    // bug. So force an update check and activate the new worker first.
    try {
      if (needRefresh) await updateServiceWorker(true);
      else await activateNewVersionAndReload();
    } finally {
      setBusy(false);
    }
  }

  const newBuildTime = newVersion?.buildTime ?? __BUILD_TIME__;

  return (
    <div className="update-banner" role="status">
      <span>
        New version available{newVersion ? ` (${formatDate(newBuildTime)})` : ""} — you&rsquo;re on{" "}
        {formatDate(__BUILD_TIME__)}.
      </span>
      <a href={changelogUrl(newBuildTime)} target="_blank" rel="noopener noreferrer">
        Changelog
      </a>
      <button type="button" onClick={() => void refresh()} disabled={busy}>
        {busy ? "Updating…" : "Refresh"}
      </button>
    </div>
  );
}
