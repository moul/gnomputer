import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, cleanup, waitFor, act } from "@testing-library/react";
import type { GnomputerSDK } from "@gnomputer/app-sdk";
import { SdkProvider } from "../sdk-context";
import { useShellStore } from "../store";
import { useWindowStore, type WindowRecord } from "./window-store";
import { useWindowPersistence } from "./use-window-persistence";

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

/** Layouts keyed by storage key, so a switch reads a different desktop. */
function fakeSdk(stored: Record<string, unknown>) {
  const writes: string[] = [];
  const sdk = {
    uiState: {
      get: async (key: string) => {
        const value = stored[key];
        return value === undefined ? null : JSON.stringify(value);
      },
      set: async (key: string) => {
        writes.push(key);
      },
      keys: async () => Object.keys(stored),
      remove: async () => {},
    },
  } as unknown as GnomputerSDK;
  return { sdk, writes };
}

function Harness() {
  useWindowPersistence("window-layout:home:v10");
  return null;
}

function mount(sdk: GnomputerSDK) {
  return render(
    <SdkProvider overrideSdk={sdk}>
      <Harness />
    </SdkProvider>
  );
}

/** Lets the hook's async restore resolve before the test acts on the store. */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

/** One deliberate switch, as `activateNetwork()` performs it. */
function switchTo(networkId: string) {
  useShellStore.getState().setNetworkSwitching(true);
  useShellStore.getState().setActiveNetwork(networkId);
  useShellStore.getState().noteNetworkSwitch();
}

beforeEach(() => {
  useShellStore.setState({
    activeNetworkId: "sapphire",
    networkSwitchSeq: 0,
    networkSwitching: false,
    carryWindowId: null,
  });
  useWindowStore.setState({ windows: {}, topZIndex: 1 });
});

afterEach(cleanup);

describe("window layout across a network switch", () => {
  it("restores the layout stored for the active network", async () => {
    const { sdk } = fakeSdk({
      "window-layout:home:v10:sapphire": {
        windows: { settings: windowRecord({ title: "Settings" }) },
        viewport: { width: 1280, height: 720 },
      },
    });
    mount(sdk);

    await waitFor(() => {
      expect(useWindowStore.getState().windows.settings).toBeDefined();
    });
  });

  it("replaces the desktop rather than merging the previous chain's windows", async () => {
    // Each network has its own set of open windows. Merging would leave a
    // window from the chain just left sitting on one where it was never
    // opened — the bug per-network layout exists to fix.
    const { sdk } = fakeSdk({
      "window-layout:home:v10:sapphire": {
        windows: { settings: windowRecord({ title: "Settings" }) },
        viewport: { width: 1280, height: 720 },
      },
      "window-layout:home:v10:betanet": {
        windows: { realm: windowRecord({ title: "Browser" }) },
        viewport: { width: 1280, height: 720 },
      },
    });
    mount(sdk);
    await waitFor(() => expect(useWindowStore.getState().windows.settings).toBeDefined());

    act(() => switchTo("betanet"));

    await waitFor(() => {
      const windows = useWindowStore.getState().windows;
      expect(windows.realm).toBeDefined();
      expect(windows.settings).toBeUndefined();
    });
  });

  it("lowers the switching flag once the new desktop is up", async () => {
    // The boot overlay is shown against this, so leaving it raised would cover
    // the desktop indefinitely.
    const { sdk } = fakeSdk({});
    mount(sdk);
    await waitFor(() => expect(useShellStore.getState().networkSwitching).toBe(false));

    act(() => switchTo("betanet"));

    await waitFor(() => expect(useShellStore.getState().networkSwitching).toBe(false));
  });

  it("writes under the key of the network being switched to", async () => {
    // Nothing is written until the desktop actually changes, so each phase
    // moves a window to produce one.
    const { sdk, writes } = fakeSdk({});
    mount(sdk);
    // Writes stay shut until this network's layout has loaded, and the
    // subscriber only fires on a change — so a mutation before that lands is
    // simply dropped.
    await settle();

    act(() => {
      useWindowStore.setState({ windows: { realm: windowRecord() } });
    });
    await waitFor(() => expect(writes.some((key) => key.endsWith(":sapphire"))).toBe(true));

    act(() => switchTo("betanet"));
    await waitFor(() => expect(useShellStore.getState().networkSwitching).toBe(false));
    await settle();
    writes.length = 0;

    act(() => {
      useWindowStore.setState({ windows: { realm: windowRecord({ x: 42 }) } });
    });

    await waitFor(() => expect(writes.length).toBeGreaterThan(0));
    // Never the chain just left: a write landing after the switch under the
    // outgoing key would save the incoming desktop over the wrong layout.
    expect(writes.every((key) => key.endsWith(":betanet"))).toBe(true);
  });
});
