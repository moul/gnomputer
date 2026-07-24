import { useEffect } from "react";
import { useZoomStore } from "./zoom-store";
import { useStorePersistence } from "./use-store-persistence";

const STORAGE_KEY = "zoom";

function deserialize(raw: string): { zoom: number } | null {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? { zoom: parsed } : null;
}

export function useZoomPersistence() {
  useEffect(() => {
    // Apply the device-aware default right away — don't leave the very
    // first paint on a phone at desktop zoom while IndexedDB is still
    // opening. Separate from the load-then-subscribe cycle below, which
    // only matters once sdk.uiState actually resolves.
    useZoomStore.getState().setZoom(useZoomStore.getState().zoom);
  }, []);

  useStorePersistence(STORAGE_KEY, useZoomStore, {
    serialize: (state) => String(state.zoom),
    deserialize,
    // setZoom (not a raw setState) also writes .desktop's CSS zoom
    // property — restoring via setState alone would update the store
    // without ever rescaling the desktop.
    onRestore: (restored) => {
      if (restored.zoom !== undefined) useZoomStore.getState().setZoom(restored.zoom);
    },
  });
}
