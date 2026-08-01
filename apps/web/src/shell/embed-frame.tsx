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
        {/* The url is always a curated value from network-config.ts, so the
            sandbox is defence in depth rather than distrust — but note what
            is NOT granted: allow-top-navigation. Without it an embedded page
            cannot navigate the whole Gnomputer tab somewhere else, which it
            otherwise could, and which a visitor would experience as
            Gnomputer itself redirecting them.

            allow-same-origin is required for the embedded tool's own
            storage. Pairing it with allow-scripts only defeats a sandbox
            when the framed document is same-origin with this page; these
            embeds are cross-origin, so it does not. */}
        <iframe
          key={reloadKey}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
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
