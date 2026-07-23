import { useEffect, useRef } from "react";
import { useSdk } from "../sdk-context";
import { useZoomStore } from "./zoom-store";

const STORAGE_KEY = "zoom";

export function useZoomPersistence() {
  const sdk = useSdk();
  const hydrated = useRef(false);

  useEffect(() => {
    // Apply the device-aware default right away — don't leave the very
    // first paint on a phone at desktop zoom while IndexedDB is still
    // opening.
    useZoomStore.getState().setZoom(useZoomStore.getState().zoom);
    let cancelled = false;
    void (async () => {
      const saved = await sdk.uiState.get(STORAGE_KEY);
      const parsed = saved ? Number(saved) : NaN;
      if (!cancelled && Number.isFinite(parsed)) {
        useZoomStore.getState().setZoom(parsed);
      }
      hydrated.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [sdk]);

  useEffect(() => {
    const unsubscribe = useZoomStore.subscribe((state) => {
      if (!hydrated.current) return;
      void sdk.uiState.set(STORAGE_KEY, String(state.zoom));
    });
    return unsubscribe;
  }, [sdk]);
}
