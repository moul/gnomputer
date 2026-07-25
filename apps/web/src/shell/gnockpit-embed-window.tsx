import { Window } from "./window";
import { useGnockpitEmbedWindowStore } from "./gnockpit-embed-window-store";

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
        {url ? (
          <>
            <p className="embed-window__bar">
              <span className="embed-window__url">{url}</span>
              <a href={url} target="_blank" rel="noopener noreferrer">
                Open externally ↗
              </a>
            </p>
            {/* No sandbox restriction — gnockpitUrl is a curated, trusted
                URL from network-config.ts, not arbitrary input. */}
            <iframe className="embed-window__frame" src={url} title="Gnockpit" />
          </>
        ) : (
          <p className="state-line">Nothing to show yet.</p>
        )}
      </div>
    </Window>
  );
}
