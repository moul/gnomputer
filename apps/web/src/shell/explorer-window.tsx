import { Window } from "./window";
import { useExplorerWindowStore } from "./explorer-window-store";

// A dedicated window for mygnoscan (network.explorerUrl) — not a generic
// "Embed" shell with a dynamic title, since every caller (Network Monitor,
// the Address window, Block Explorer, Discover's hover menu) is always
// showing the same tool, just at a different URL within it. One real app
// identity beats a generic iframe box that happens to say "Explorer" today
// and something else tomorrow.
export function ExplorerWindow() {
  const url = useExplorerWindowStore((s) => s.url);

  return (
    <Window
      id="explorer"
      title="Explorer"
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
            {/* No sandbox restriction — explorerUrl is a curated, trusted
                URL from network-config.ts, not arbitrary input, and a
                restrictive sandbox would break mygnoscan's own JS/storage. */}
            <iframe className="embed-window__frame" src={url} title="Explorer" />
          </>
        ) : (
          <p className="state-line">Nothing to show yet.</p>
        )}
      </div>
    </Window>
  );
}
