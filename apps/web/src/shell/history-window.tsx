import { useEffect, useState } from "react";
import { useSdk } from "../sdk-context";
import { useShellStore } from "../store";
import { Window } from "./window";
import { openRef } from "./open-ref";
import { iconForRefUri } from "./entity-icon";
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

        {trails.length > 1 && (
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
                  <button type="button" onClick={() => openRef(step.refUri)}>
                    <span className="history-list__icon" aria-hidden="true">
                      {iconForRefUri(step.refUri)}
                    </span>
                    {step.label}
                  </button>
                </li>
              ))}
          </ul>
        )}
      </div>
    </Window>
  );
}
