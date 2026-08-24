import { describe, it, expect, beforeEach, vi } from "vitest";
import type { GnomputerSDK, NetworkConfig } from "@gnomputer/app-sdk";
import { useShellStore } from "../store";
import { useCustomNetworksStore } from "./custom-networks-store";
import { useWindowStore, type WindowRecord } from "./window-store";
import { useAddressWindowStore } from "./address-window-store";
import { usePendingRefsStore } from "./pending-refs-store";
import { activateNetwork, listSelectableNetworks } from "./activate-network";

function windowRecord(overrides: Partial<WindowRecord> = {}): WindowRecord {
  return {
    x: 0,
    y: 0,
    width: 400,
    height: 300,
    title: "w",
    zIndex: 1,
    closed: false,
    maximized: false,
    preMaximizeGeometry: null,
    ...overrides,
  };
}

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

function fakeSdk(builtIns: NetworkConfig[]) {
  const setActiveConfig = vi.fn();
  return {
    sdk: { networks: { list: () => builtIns, setActiveConfig } } as unknown as GnomputerSDK,
    setActiveConfig,
  };
}

beforeEach(() => {
  useShellStore.setState({
    activeNetworkId: "sapphire",
    networkSwitchSeq: 0,
    networkSwitching: false,
    carryWindowId: null,
  });
  useCustomNetworksStore.setState({ networks: [] });
  useWindowStore.setState({ windows: {} });
  useAddressWindowStore.setState({ currentAddress: null });
  usePendingRefsStore.setState({ pendingBlockHeight: null });
});

describe("listSelectableNetworks", () => {
  it("joins the built-ins with the user's custom networks", () => {
    // Custom networks are not tracked inside the SDK, so the two lists have to
    // be joined — doing it in one place keeps Settings and the island offering
    // the same set.
    useCustomNetworksStore.setState({ networks: [net("mine")] });
    const { sdk } = fakeSdk([net("sapphire"), net("topaz")]);

    expect(listSelectableNetworks(sdk).map((n) => n.id)).toEqual(["sapphire", "topaz", "mine"]);
  });
});

describe("activateNetwork", () => {
  it("repoints the SDK and the store together", () => {
    // Both halves are required: the SDK holds the config queries are built
    // from, the store holds the id that is persisted and rendered. Setting
    // only the store would leave queries on the old chain under the new name.
    const { sdk, setActiveConfig } = fakeSdk([net("sapphire"), net("topaz")]);
    const topaz = net("topaz");

    activateNetwork(sdk, topaz);

    expect(setActiveConfig).toHaveBeenCalledWith(topaz);
    expect(useShellStore.getState().activeNetworkId).toBe("topaz");
  });

  it("counts the switch, so per-network state knows to reload", () => {
    const { sdk } = fakeSdk([net("sapphire"), net("topaz")]);

    activateNetwork(sdk, net("topaz"));

    expect(useShellStore.getState().networkSwitchSeq).toBe(1);
  });

  it("does nothing when the network is already active", () => {
    // Re-selecting the current network must not count as a switch: that would
    // discard the realm tabs open on it for no reason.
    const { sdk, setActiveConfig } = fakeSdk([net("sapphire")]);

    activateNetwork(sdk, net("sapphire"));

    expect(setActiveConfig).not.toHaveBeenCalled();
    expect(useShellStore.getState().networkSwitchSeq).toBe(0);
  });

  it("carries the frontmost window, so a switch does not close what is in use", () => {
    // The network picker lives in Settings: without this, switching from
    // inside it closes the window at the moment it is being used.
    useWindowStore.setState({
      windows: {
        realm: windowRecord({ zIndex: 2 }),
        settings: windowRecord({ zIndex: 9 }),
      },
    });
    const { sdk } = fakeSdk([net("sapphire"), net("topaz")]);

    activateNetwork(sdk, net("topaz"));

    expect(useShellStore.getState().carryWindowId).toBe("settings");
  });

  it("ignores closed windows when deciding what to carry", () => {
    useWindowStore.setState({
      windows: {
        realm: windowRecord({ zIndex: 2 }),
        settings: windowRecord({ zIndex: 9, closed: true }),
      },
    });
    const { sdk } = fakeSdk([net("sapphire"), net("topaz")]);

    activateNetwork(sdk, net("topaz"));

    expect(useShellStore.getState().carryWindowId).toBe("realm");
  });

  it("carries nothing when the desktop is empty", () => {
    useWindowStore.setState({ windows: {} });
    const { sdk } = fakeSdk([net("sapphire"), net("topaz")]);

    activateNetwork(sdk, net("topaz"));

    expect(useShellStore.getState().carryWindowId).toBeNull();
  });

  it("clears content that only meant something on the previous chain", () => {
    // An address and a block height are read from one chain; the windows that
    // reopen onto them would otherwise show the old chain's subject.
    useAddressWindowStore.setState({ currentAddress: "g1abc" });
    usePendingRefsStore.setState({ pendingBlockHeight: 42 });
    const { sdk } = fakeSdk([net("sapphire"), net("topaz")]);

    activateNetwork(sdk, net("topaz"));

    expect(useAddressWindowStore.getState().currentAddress).toBeNull();
    expect(usePendingRefsStore.getState().pendingBlockHeight).toBeNull();
  });

  it("raises the switching flag the overlay is shown against", () => {
    const { sdk } = fakeSdk([net("sapphire"), net("topaz")]);

    activateNetwork(sdk, net("topaz"));

    expect(useShellStore.getState().networkSwitching).toBe(true);
  });

  it("counts each distinct switch separately", () => {
    const { sdk } = fakeSdk([net("sapphire"), net("topaz"), net("betanet")]);

    activateNetwork(sdk, net("topaz"));
    activateNetwork(sdk, net("betanet"));

    expect(useShellStore.getState().networkSwitchSeq).toBe(2);
    expect(useShellStore.getState().activeNetworkId).toBe("betanet");
  });
});
