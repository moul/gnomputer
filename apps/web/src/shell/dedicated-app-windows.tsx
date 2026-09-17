import { Window } from "./window";
import { EmbedFrame } from "./embed-frame";
import { DEDICATED_APPS } from "./dedicated-apps";

// One dedicated window per DEDICATED_APPS entry, each just the real external
// site in the shared embed chrome (same shape as GnockpitEmbedWindow) — a
// generic shell rather than a bespoke component per app, since none of these
// have a native in-app counterpart to stay distinct from (unlike Gnockpit's
// real dashboard vs. its own lightweight RPC-backed summary). Always
// mounted, startClosed: reachable only from wherever a caller decides the
// app is actually available (island-discover-menu.tsx), never opened on its
// own.
export function DedicatedAppWindows() {
  return (
    <>
      {DEDICATED_APPS.map((app) => (
        <Window
          key={app.id}
          id={app.id}
          title={app.label}
          accent="magenta"
          startClosed
          defaultGeometry={{ x: 140, y: 140, width: 720, height: 560 }}
        >
          <div className="embed-window">
            <EmbedFrame url={app.url} title={app.label} />
          </div>
        </Window>
      ))}
    </>
  );
}
