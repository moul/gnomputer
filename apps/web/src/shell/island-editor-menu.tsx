import { useQuery } from "@tanstack/react-query";
import { useSdk } from "../sdk-context";
import { useEditorSignalStore } from "./editor-store";
import { focusOrReopen } from "./open-ref";

const RECENT_SCRIPTS_LIMIT = 10;

function openScript(id: string) {
  useEditorSignalStore.getState().openScript(id);
  focusOrReopen("editor");
}

/** Hovering the Editor icon lists the most recently updated local scripts —
 * sdk.scripts.list() already sorts by updatedSeq (most recent edit first),
 * the same recency signal Editor's own sidebar uses, just capped and shown
 * without opening the window first. */
export function IslandEditorMenu() {
  const sdk = useSdk();
  const { data: scripts } = useQuery({
    queryKey: ["editor-scripts"],
    queryFn: () => sdk.scripts.list(),
  });

  const recent = (scripts ?? []).slice(0, RECENT_SCRIPTS_LIMIT);

  return (
    <div className="island-menu">
      <p className="island-menu__title">Editor</p>
      {recent.length === 0 ? (
        <p className="island-menu__hint">No scripts yet.</p>
      ) : (
        <ul className="island-menu__list">
          {recent.map((script) => (
            <li key={script.id}>
              <button type="button" onClick={() => openScript(script.id)}>
                <span aria-hidden="true">📝</span>
                {script.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="island-menu__action" onClick={() => focusOrReopen("editor")}>
        Open Editor →
      </button>
    </div>
  );
}
