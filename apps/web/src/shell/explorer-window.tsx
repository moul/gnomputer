import { Window } from "./window";
import { useExplorerWindowStore } from "./explorer-window-store";
import { EmbedFrame } from "./embed-frame";

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
        <EmbedFrame url={url} title="Explorer" />
      </div>
    </Window>
  );
}
