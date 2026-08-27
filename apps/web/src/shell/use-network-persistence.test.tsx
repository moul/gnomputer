import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";
import type { GnomputerSDK, NetworkConfig } from "@gnomputer/app-sdk";
import { SdkProvider } from "../sdk-context";
import { useShellStore } from "../store";
import { useCustomNetworksStore } from "./custom-networks-store";
import { useNetworkPersistence } from "./use-network-persistence";

function net(id: string): NetworkConfig {
  return {
    id,
    name: `${id} network`,
    chainId: `${id}-1`,
    rpcUrl: `https://rpc.${id}.example`,
    environment: "testnet",
    persistence: "rolling",
    trust: "official",
    capabilities: [],
  };
}

const BUILT_INS = [net("pearl"), net("sapphire"), net("topaz")];

/**
 * An SDK whose active network really moves when `setActiveConfig` is called.
 *
 * A `vi.fn()` that records the call and changes nothing would let every
 * assertion here pass while the app stayed on the wrong chain — and "the SDK
 * and the store name the same chain" is the entire thing under test.
 */
function fakeSdk(startOn: NetworkConfig, stored?: Record<string, string>) {
  let active = startOn;
  const store = new Map(Object.entries(stored ?? {}));
  const sdk = {
    networks: {
      list: () => BUILT_INS,
      getActive: () => active,
      getDefault: () => BUILT_INS[0]!,
      setActiveConfig: vi.fn((config: NetworkConfig) => {
        active = config;
      }),
    },
    uiState: {
      get: async (key: string) => store.get(key) ?? null,
      set: async (key: string, value: string) => {
        store.set(key, value);
      },
      keys: async () => [...store.keys()],
      remove: async () => {},
    },
  } as unknown as GnomputerSDK;
  return { sdk, activeId: () => active.id };
}

function Harness({ urlNetworkId }: { urlNetworkId?: string }) {
  const { unresolvedNetworkId } = useNetworkPersistence(urlNetworkId);
  return <span data-testid="unresolved">{unresolvedNetworkId ?? ""}</span>;
}

beforeEach(() => {
  localStorage.clear();
  useShellStore.setState({ activeNetworkId: "pearl", networkHydrated: false });
  useCustomNetworksStore.setState({ networks: [] });
});

afterEach(cleanup);

describe("useNetworkPersistence", () => {
  it("adopts the SDK's network when nothing is stored, rather than pushing its own default", () => {
    // The store's activeNetworkId is a placeholder — it is built before the
    // SDK exists. Pushing it at the SDK would overwrite an active config the
    // store never knew about, which is exactly what the e2e mock network is:
    // an early version of this hook sent the whole test suite at the live
    // chain that way.
    const { sdk, activeId } = fakeSdk(net("mock"));
    render(
      <SdkProvider overrideSdk={sdk}>
        <Harness />
      </SdkProvider>
    );

    return waitFor(() => {
      expect(useShellStore.getState().activeNetworkId).toBe("mock");
      expect(activeId()).toBe("mock");
      expect(useShellStore.getState().networkHydrated).toBe(true);
    });
  });

  it("puts the SDK on the network that was stored", async () => {
    const { sdk, activeId } = fakeSdk(net("pearl"), {
      "active-network": JSON.stringify("topaz"),
    });
    render(
      <SdkProvider overrideSdk={sdk}>
        <Harness />
      </SdkProvider>
    );

    await waitFor(() => expect(activeId()).toBe("topaz"));
    expect(useShellStore.getState().activeNetworkId).toBe("topaz");
    expect(useShellStore.getState().networkHydrated).toBe(true);
  });

  it("lets a network named in the URL beat both the stored choice and the default", async () => {
    // Someone opening a shared link is asking for that chain specifically.
    const { sdk, activeId } = fakeSdk(net("pearl"), {
      "active-network": JSON.stringify("topaz"),
    });
    render(
      <SdkProvider overrideSdk={sdk}>
        <Harness urlNetworkId="sapphire" />
      </SdkProvider>
    );

    await waitFor(() => expect(activeId()).toBe("sapphire"));
    expect(useShellStore.getState().activeNetworkId).toBe("sapphire");
  });

  it("reports a stored network that no longer exists and falls back to the default", async () => {
    const { sdk, activeId } = fakeSdk(net("pearl"), {
      "active-network": JSON.stringify("ghost-net"),
    });
    const { getByTestId } = render(
      <SdkProvider overrideSdk={sdk}>
        <Harness />
      </SdkProvider>
    );

    await waitFor(() => expect(getByTestId("unresolved").textContent).toBe("ghost-net"));
    // Named, not silently swapped — and it still ends up somewhere usable.
    await waitFor(() => expect(useShellStore.getState().activeNetworkId).toBe("pearl"));
    expect(activeId()).toBe("pearl");
  });

  it("reports an unresolvable ?net= and still lands the SDK and the store on the same chain", async () => {
    // This branch used to `return` right after recording the failure, which
    // left the SDK on one chain while the store — and so the island, and every
    // per-network storage key — named another. The UI reported a network no
    // query was going to, and networkHydrated could never be reached.
    const { sdk, activeId } = fakeSdk(net("pearl"), {
      "active-network": JSON.stringify("topaz"),
    });
    const { getByTestId } = render(
      <SdkProvider overrideSdk={sdk}>
        <Harness urlNetworkId="ghost-net" />
      </SdkProvider>
    );

    await waitFor(() => expect(getByTestId("unresolved").textContent).toBe("ghost-net"));
    await waitFor(() => {
      expect(useShellStore.getState().networkHydrated).toBe(true);
      expect(activeId()).toBe(useShellStore.getState().activeNetworkId);
    });
    // The stored preference is what it falls back to, not the default: only
    // the URL was unusable.
    expect(activeId()).toBe("topaz");
  });

  it("resolves a custom network from the URL once the custom list has loaded", async () => {
    const custom = net("my-node");
    const { sdk, activeId } = fakeSdk(net("pearl"), {
      "custom-networks": JSON.stringify([custom]),
    });
    render(
      <SdkProvider overrideSdk={sdk}>
        <Harness urlNetworkId="my-node" />
      </SdkProvider>
    );

    await waitFor(() => expect(activeId()).toBe("my-node"));
    expect(useShellStore.getState().activeNetworkId).toBe("my-node");
  });

  it("does not flash the recovery notice for a custom network that simply has not loaded yet", async () => {
    // A custom id looks exactly like a deleted one until the list settles.
    // Deciding too early put the notice on screen on every single reload onto
    // a custom network.
    const custom = net("my-node");
    const { sdk } = fakeSdk(net("pearl"), {
      "active-network": JSON.stringify("my-node"),
      "custom-networks": JSON.stringify([custom]),
    });
    const { getByTestId } = render(
      <SdkProvider overrideSdk={sdk}>
        <Harness />
      </SdkProvider>
    );

    await waitFor(() => expect(useShellStore.getState().networkHydrated).toBe(true));
    expect(getByTestId("unresolved").textContent).toBe("");
    expect(useShellStore.getState().activeNetworkId).toBe("my-node");
  });
});
