import { useEffect, useState } from "react";
import { useSdk } from "../sdk-context";
import { useShellStore } from "../store";

const MAX_VISIBLE_STEPS = 8;

export function TrailBreadcrumb() {
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

  if (steps.length === 0) return null;

  const hiddenCount = Math.max(0, steps.length - MAX_VISIBLE_STEPS);
  const visible = steps.slice(-MAX_VISIBLE_STEPS);

  return (
    <div className="trail-breadcrumb-row">
      <nav aria-label="Trail" className="trail-breadcrumb">
        {hiddenCount > 0 && <span className="trail-breadcrumb__sep">… +{hiddenCount}</span>}
        {visible.map((step, i) => (
          <span key={`${step.refUri}-${i}`}>
            {i > 0 || hiddenCount > 0 ? <span className="trail-breadcrumb__sep">›</span> : null}
            {step.label}
          </span>
        ))}
      </nav>
      <button
        type="button"
        className="trail-breadcrumb__clear"
        onClick={async () => {
          await sdk.trails.start("Untitled Trail");
          bumpTrailVersion();
        }}
      >
        Clear trail
      </button>
    </div>
  );
}
