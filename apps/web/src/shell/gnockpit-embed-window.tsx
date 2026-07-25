import { Window } from "./window";
import { useGnockpitEmbedWindowStore } from "./gnockpit-embed-window-store";
import { EmbedFrame } from "./embed-frame";

// The real, external Gnockpit dashboard (network.gnockpitUrl) in its own
// dedicated window — distinct from the native "Gnockpit" app (gnockpit.tsx,
// id "gnockpit"), which is a lightweight RPC-backed summary living inside
// Gnomputer itself, not an iframe. This one exists purely to show the real
// external tool, so it gets its own identity rather than a generic "Embed"
// shell that could just as easily have been showing something else.
export function GnockpitEmbedWindow() {
  const url = useGnockpitEmbedWindowStore((s) => s.url);

  return (
    <Window
      id="gnockpit-embed"
      title="Gnockpit"
      accent="green"
      startClosed
      defaultGeometry={{ x: 120, y: 120, width: 720, height: 560 }}
    >
      <div className="embed-window">
        <EmbedFrame url={url} title="Gnockpit" />
      </div>
    </Window>
  );
}
