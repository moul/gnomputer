import { useEffect, useState } from "react";
import { useSdk } from "../sdk-context";
import { useShellStore } from "../store";
import { Window } from "./window";
import { openRef } from "./open-ref";
import { iconForRefUri } from "./entity-icon";
import { downloadJson } from "./local-data-recovery";
import type { TrailSummary } from "@gnomputer/app-sdk";

export function HistoryWindow() {
  const sdk = useSdk();
  const trailVersion = useShellStore((s) => s.trailVersion);
  const bumpTrailVersion = useShellStore((s) => s.bumpTrailVersion);
  const [steps, setSteps] = useState<{ refUri: string; label: string }[]>([]);
  const [trails, setTrails] = useState<TrailSummary[]>([]);
  const [activeTrailId, setActiveTrailId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const trailId = await sdk.trails.getActiveTrailId();
      if (cancelled) return;
      const [trailSteps, allTrails] = await Promise.all([
        trailId ? sdk.trails.getSteps(trailId) : Promise.resolve([]),
        sdk.trails.listTrails(),
      ]);
      if (cancelled) return;
      setActiveTrailId(trailId);
      setSteps(trailSteps);
      setTrails(allTrails);
      setNameDraft(allTrails.find((t) => t.id === trailId)?.name ?? "");
      setRenaming(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [sdk, trailVersion]);

  async function switchTrail(id: string) {
    if (id === activeTrailId) return;
    await sdk.trails.setActiveTrail(id);
    bumpTrailVersion();
  }

  async function newTrail() {
    await sdk.trails.start("Untitled Trail");
    bumpTrailVersion();
  }

  async function removeTrail(id: string, name: string, stepCount: number) {
    // Confirmed only when there is something to lose. A Trail you just
    // started and never used is noise, and a dialog for it trains people
    // to dismiss the one that matters.
    if (stepCount > 0) {
      const plural = stepCount === 1 ? "step" : "steps";
      if (!window.confirm(`Delete "${name}" and its ${stepCount} ${plural}? This can't be undone.`)) {
        return;
      }
    }
    await sdk.trails.deleteTrail(id);
    bumpTrailVersion();
  }

  async function exportTrail(id: string, name: string) {
    const data = await sdk.trails.exportTrail(id);
    if (!data) return;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "trail";
    downloadJson(data, `gnomputer-trail-${slug}.json`);
  }

  async function commitRename() {
    if (activeTrailId && nameDraft.trim()) {
      await sdk.trails.rename(activeTrailId, nameDraft.trim());
      bumpTrailVersion();
    } else {
      setRenaming(false);
    }
  }

  const activeTrail = trails.find((t) => t.id === activeTrailId);

  return (
    <Window
      id="history"
      title="History"
      accent="green"
      startClosed
      defaultGeometry={{ x: 120, y: 90, width: 380, height: 360 }}
    >
      <div className="history-window">
        <div className="history-window__header">
          {renaming ? (
            <form
              className="history-window__rename-form"
              onSubmit={(e) => {
                e.preventDefault();
                void commitRename();
              }}
            >
              <input
                type="text"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-1p-ignore="true"
                data-lpignore="true"
                data-bwignore="true"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={() => void commitRename()}
                autoFocus
              />
            </form>
          ) : (
            <button
              type="button"
              className="history-window__trail-name"
              onClick={() => setRenaming(true)}
              title="Rename this Trail"
            >
              {activeTrail?.name ?? "Untitled Trail"} <span aria-hidden="true">✎</span>
            </button>
          )}
          <button type="button" className="history-window__new-trail" onClick={() => void newTrail()}>
            + New Trail
          </button>
        </div>

        {/* Rendered for one Trail as well as many. The list used to appear
            only at two or more, which was fine while it was purely a
            switcher — but export and delete live here now, and gating them
            on having happened to start a second Trail put "delete my
            history" out of reach for exactly the person most likely to
            want it. */}
        {trails.length > 0 && (
          <ul className="history-window__trail-list">
            {trails.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  data-active={t.id === activeTrailId}
                  onClick={() => void switchTrail(t.id)}
                >
                  {t.name}
                  <span className="history-window__trail-steps">
                    {t.stepCount} {t.stepCount === 1 ? "step" : "steps"}
                  </span>
                </button>
                <button
                  type="button"
                  className="history-window__trail-action"
                  aria-label={`Export "${t.name}"`}
                  title="Export as JSON"
                  onClick={() => void exportTrail(t.id, t.name)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="history-window__trail-action history-window__trail-delete"
                  aria-label={`Delete "${t.name}"`}
                  title="Delete this Trail"
                  onClick={() => void removeTrail(t.id, t.name, t.stepCount)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        {steps.length === 0 ? (
          <p className="state-line">Nothing visited yet on this Trail.</p>
        ) : (
          <ul className="history-list">
            {steps
              .slice()
              .reverse()
              .map((step, i) => (
                <li key={`${step.refUri}-${i}`}>
                  <button type="button" onClick={(e) => openRef(step.refUri, { x: e.clientX, y: e.clientY })}>
                    <span className="history-list__icon" aria-hidden="true">
                      {iconForRefUri(step.refUri)}
                    </span>
                    {step.label}
                  </button>
                </li>
              ))}
          </ul>
        )}

        {/* Says where this lives. A Trail records where you have been, and
            leaving someone to guess whether that is on a server is not a
            neutral omission — especially in an app whose whole pitch is
            read-only and wallet-free. */}
        <p className="history-window__scope state-line">
          Trails stay in this browser. Nothing here is uploaded, and clearing your browser data
          removes them.
        </p>
      </div>
    </Window>
  );
}
