import { useEffect, useRef, useState } from "react";
import { useSdk } from "../sdk-context";
import { useShellStore } from "../store";
import { useStorePersistence } from "./use-store-persistence";
import { useCustomNetworksStore } from "./custom-networks-store";
import { useCustomNetworksPersistence } from "./use-custom-networks-persistence";

const STORAGE_KEY = "active-network";

/** Persists which network you're on, and puts it back on the next visit.
 *
 * Custom network *definitions* were already persisted, but the selection
 * wasn't: every reload dropped you back on the default. Switching to betanet
 * and reloading silently returned you to Topaz, showing a different chain's
 * data under an identical UI (AUD-013).
 *
 * Restoring is not just reading the id back:
 *
 * - A custom network's id can only be resolved once the custom-network list
 *   has hydrated, so this owns both hydrations and treats an id as missing
 *   only after that list has settled. Otherwise every reload onto a custom
 *   network would flash the recovery notice.
 *
 * - When nothing is stored, the SDK is the source of truth and the store
 *   adopts *its* network, not the other way round. Pushing the store's
 *   untouched default at the SDK would overwrite an active config the store
 *   never knew about — which is exactly what the e2e mock network is, and
 *   an early version of this hook silently sent the whole test suite at the
 *   live chain.
 *
 * Returns the id that could not be restored, if any, so the shell can say so
 * rather than quietly putting you on a different chain. */
export function useNetworkPersistence(urlNetworkId?: string): {
  unresolvedNetworkId: string | null;
} {
  const sdk = useSdk();
  const customHydrated = useCustomNetworksPersistence();
  const restored = useRef(false);

  const selectionHydrated = useStorePersistence(STORAGE_KEY, useShellStore, {
    serialize: (state) => JSON.stringify(state.activeNetworkId),
    deserialize: (raw) => {
      const parsed: unknown = JSON.parse(raw);
      return typeof parsed === "string" ? { activeNetworkId: parsed } : null;
    },
    onRestore: (state) => {
      restored.current = true;
      useShellStore.setState(state);
    },
  });

  const activeNetworkId = useShellStore((s) => s.activeNetworkId);
  const setActiveNetwork = useShellStore((s) => s.setActiveNetwork);
  const customNetworks = useCustomNetworksStore((s) => s.networks);
  const [unresolvedNetworkId, setUnresolvedNetworkId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectionHydrated) return;

    const active = sdk.networks.getActive();

    // A network named in the URL wins over both the stored preference and
    // the default. Someone opening a shared link is asking for that chain
    // specifically; showing them a different one under the same URL is the
    // failure this whole hook exists to avoid.
    if (urlNetworkId && urlNetworkId !== activeNetworkId) {
      const fromUrl =
        sdk.networks.list().find((n) => n.id === urlNetworkId) ??
        customNetworks.find((n) => n.id === urlNetworkId);
      if (fromUrl) {
        sdk.networks.setActiveConfig(fromUrl);
        setActiveNetwork(urlNetworkId);
        return;
      }
      if (customHydrated) {
        setUnresolvedNetworkId(urlNetworkId);
        return;
      }
      return;
    }

    if (!restored.current) {
      if (active.id !== activeNetworkId) setActiveNetwork(active.id);
      return;
    }
    if (active.id === activeNetworkId) return;

    const config =
      sdk.networks.list().find((n) => n.id === activeNetworkId) ??
      customNetworks.find((n) => n.id === activeNetworkId);

    if (config) {
      sdk.networks.setActiveConfig(config);
      return;
    }

    if (!customHydrated) return;

    // Recorded once and never cleared here. Falling back below re-runs this
    // effect with the default id, which then resolves — clearing the notice
    // at that point would erase it before it was ever painted. It is a
    // one-time fact about this boot, and the banner is dismissible.
    setUnresolvedNetworkId(activeNetworkId);
    setActiveNetwork(sdk.networks.getDefault().id);
  }, [
    sdk,
    urlNetworkId,
    activeNetworkId,
    customNetworks,
    customHydrated,
    selectionHydrated,
    setActiveNetwork,
  ]);

  return { unresolvedNetworkId };
}
