import { useState } from "react";

const ZOOM_STEP = 0.1;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 1.5;

/** The shared toolbar+iframe body for every embedded third-party page
 * (the Explorer/Gnockpit dedicated windows, the Graph lens's mygnoscan
 * embed) — zoom (scales the iframe's content, not just the chrome around
 * it — a real third-party page's own responsive layout doesn't otherwise
 * get any smaller/bigger just from resizing the window) and a refresh
 * button (remounts the iframe via a key bump — the one reliable cross-
 * origin way to force a reload; `contentWindow.location.reload()` throws
 * for a cross-origin frame, which every embed here always is). */
export function EmbedFrame({
  url,
  title,
  showUrl = true,
  externalLinkLabel = "Open externally ↗",
}: {
  url: string | null;
  title: string;
  /** False for a narrower per-tab toolbar (the Graph lens) that already
   * has its own external link and doesn't need the raw URL repeated. */
  showUrl?: boolean;
  externalLinkLabel?: string;
}) {
  const [zoom, setZoom] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  if (!url) {
    return <p className="state-line">Nothing to show yet.</p>;
  }

  return (
    <>
      <p className="embed-window__bar">
        {showUrl && <span className="embed-window__url">{url}</span>}
        <span className="embed-window__controls">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)))}
            disabled={zoom <= ZOOM_MIN}
            aria-label="Zoom out"
            title="Zoom out"
          >
            −
          </button>
          <span className="embed-window__zoom-level">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)))}
            disabled={zoom >= ZOOM_MAX}
            aria-label="Zoom in"
            title="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            aria-label="Refresh"
            title="Refresh"
          >
            ↻
          </button>
          <a href={url} target="_blank" rel="noopener noreferrer">
            {externalLinkLabel}
          </a>
        </span>
      </p>
      <div className="embed-window__viewport">
        {/* No sandbox restriction — url is always a curated, trusted value
            from network-config.ts, not arbitrary input, and a restrictive
            sandbox would break the embedded tool's own JS/storage. */}
        <iframe
          key={reloadKey}
          className="embed-window__frame"
          src={url}
          title={title}
          style={{
            width: `${100 / zoom}%`,
            height: `${100 / zoom}%`,
            transform: `scale(${zoom})`,
          }}
        />
      </div>
    </>
  );
}
