import { useEffect, useRef } from "react";
import { useSdk } from "./sdk-context";
import { useShellStore } from "./store";

export function useTrailRecorder(ref: { uri: string; label: string }): void {
  const sdk = useSdk();
  const bumpTrailVersion = useShellStore((s) => s.bumpTrailVersion);
  const recordedFor = useRef<string | null>(null);

  useEffect(() => {
    if (recordedFor.current === ref.uri) return;
    recordedFor.current = ref.uri;

    void (async () => {
      const trailId = await sdk.trails.ensureActiveTrailId("Untitled Trail");
      await sdk.trails.addStep(trailId, ref.uri, ref.label);
      bumpTrailVersion();
    })();
  }, [ref.uri, ref.label, sdk, bumpTrailVersion]);
}
