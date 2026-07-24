import { useVersionCheck } from "./use-version-check";

export function UpdateBanner() {
  const newVersionAvailable = useVersionCheck();
  if (!newVersionAvailable) return null;

  return (
    <div className="update-banner" role="status">
      A new version is available.
      <button type="button" onClick={() => window.location.reload()}>
        Refresh
      </button>
    </div>
  );
}
