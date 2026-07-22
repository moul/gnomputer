import { useEffect, useRef } from "react";
import { useSdk } from "./sdk-context";

export function useTrailRecorder(ref: { uri: string; label: string }): void {
  const sdk = useSdk();
  const recordedFor = useRef<string | null>(null);

  useEffect(() => {
    if (recordedFor.current === ref.uri) return;
    recordedFor.current = ref.uri;

    void (async () => {
      let trailId = await sdk.trails.getActiveTrailId();
      if (!trailId) {
        trailId = await sdk.trails.start("Untitled Trail");
      }
      await sdk.trails.addStep(trailId, ref.uri, ref.label);
    })();
  }, [ref.uri, ref.label, sdk]);
}
