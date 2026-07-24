import { useVersionCheck } from "./use-version-check";
import { useSwUpdate } from "./use-sw-update";

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

  if (!newVersion && !needRefresh) return null;

  function refresh() {
    // needRefresh means a new service worker is actually installed and
    // waiting — updateServiceWorker(true) tells it to take over and waits
    // for that to actually happen before reloading. A plain reload can
    // still be served by the OLD (still "active" at that instant) worker,
    // silently requiring a second manual reload to see anything new.
    if (needRefresh) void updateServiceWorker(true);
    else window.location.reload();
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
      <button type="button" onClick={refresh}>
        Refresh
      </button>
    </div>
  );
}
