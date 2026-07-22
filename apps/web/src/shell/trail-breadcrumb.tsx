import { useEffect, useState } from "react";
import { useSdk } from "../sdk-context";
import { useShellStore } from "../store";

export function TrailBreadcrumb() {
  const sdk = useSdk();
  const trailVersion = useShellStore((s) => s.trailVersion);
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

  return (
    <nav aria-label="Trail" className="trail-breadcrumb">
      {steps.map((step, i) => (
        <span key={`${step.refUri}-${i}`}>
          {i > 0 ? <span className="trail-breadcrumb__sep">›</span> : null}
          {step.label}
        </span>
      ))}
    </nav>
  );
}
