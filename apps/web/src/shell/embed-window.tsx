import { Window } from "./window";
import { useEmbedWindowStore } from "./embed-window-store";

export function EmbedWindow() {
  const url = useEmbedWindowStore((s) => s.url);
  const title = useEmbedWindowStore((s) => s.title);

  return (
    <Window
      id="embed"
      title={title ? `Embed · ${title}` : "Embed"}
      accent="blue"
      startClosed
      defaultGeometry={{ x: 100, y: 100, width: 720, height: 560 }}
    >
      <div className="embed-window">
        {url ? (
          <>
            <p className="embed-window__bar">
              <span className="embed-window__url">{url}</span>
              <a href={url} target="_blank" rel="noopener noreferrer">
                Open externally ↗
              </a>
            </p>
            {/* No sandbox restriction — these are curated, trusted URLs from
                network-config.ts (mygnoscan, Gnockpit), not arbitrary input,
                and a restrictive sandbox would break their own JS/storage. */}
            <iframe className="embed-window__frame" src={url} title={title ?? "Embedded content"} />
          </>
        ) : (
          <p className="state-line">Nothing embedded yet.</p>
        )}
      </div>
    </Window>
  );
}
