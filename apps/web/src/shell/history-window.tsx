import { useEffect, useState } from "react";
import { useSdk } from "../sdk-context";
import { useShellStore } from "../store";
import { Window } from "./window";
import { openRef } from "./open-ref";
import { iconForRefUri } from "./entity-icon";

export function HistoryWindow() {
  const sdk = useSdk();
  const trailVersion = useShellStore((s) => s.trailVersion);
  const bumpTrailVersion = useShellStore((s) => s.bumpTrailVersion);
  const [steps, setSteps] = useState<{ refUri: string; label: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const trailId = await sdk.trails.getActiveTrailId();
      if (!trailId) {
        if (!cancelled) setSteps([]);
        return;
      }
      const trailSteps = await sdk.trails.getSteps(trailId);
      if (!cancelled) setSteps(trailSteps);
    })();
    return () => {
      cancelled = true;
    };
  }, [sdk, trailVersion]);

  return (
    <Window
      id="history"
      title="History"
      accent="green"
      startClosed
      defaultGeometry={{ x: 120, y: 90, width: 380, height: 360 }}
    >
      <div className="history-window">
        {steps.length === 0 ? (
          <p className="state-line">Nothing visited yet this session.</p>
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
        <button
          type="button"
          className="history-window__clear"
          onClick={async () => {
            await sdk.trails.start("Untitled Trail");
            bumpTrailVersion();
          }}
        >
          Clear history
        </button>
      </div>
    </Window>
  );
}
