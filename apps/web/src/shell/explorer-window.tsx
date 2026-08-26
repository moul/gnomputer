import { Window } from "./window";
import { useSdk } from "../sdk-context";
import { useExplorerWindowStore } from "./explorer-window-store";
import { EmbedFrame } from "./embed-frame";

// A dedicated window for mygnoscan (network.explorerUrl) — not a generic
// "Embed" shell with a dynamic title, since every caller (Network Monitor,
// the Address window, Block Explorer, Discover's hover menu) is always
// showing the same tool, just at a different URL within it. One real app
// identity beats a generic iframe box that happens to say "Explorer" today
// and something else tomorrow.
export function ExplorerWindow() {
  const sdk = useSdk();
  const requested = useExplorerWindowStore((s) => s.url);
  // Opened from the palette or the Apps menu there is no URL yet, and the
  // window said "Nothing to show yet" — a dead box for an app that has a
  // perfectly good home page. Every caller that opens it *with* a URL still
  // wins, since theirs is more specific than the fallback.
  const url = requested ?? sdk.networks.getActive().explorerUrl ?? null;

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
