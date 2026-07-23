import { useEffect, useRef } from "react";
import { useSdk } from "../sdk-context";
import { useRealmLensStore, type RealmLens } from "./realm-lens-store";

const STORAGE_KEY = "realm-browser-lens";
const VALID_LENSES: RealmLens[] = ["render", "source"];

function isRealmLens(value: string): value is RealmLens {
  return (VALID_LENSES as string[]).includes(value);
}

export function useRealmLensPersistence() {
  const sdk = useSdk();
  const hydrated = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const saved = await sdk.uiState.get(STORAGE_KEY);
      if (!cancelled && saved && isRealmLens(saved)) {
        useRealmLensStore.getState().setLens(saved);
      }
      hydrated.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [sdk]);

  useEffect(() => {
    const unsubscribe = useRealmLensStore.subscribe((state) => {
      if (!hydrated.current) return;
      void sdk.uiState.set(STORAGE_KEY, state.lens);
    });
    return unsubscribe;
  }, [sdk]);
}
