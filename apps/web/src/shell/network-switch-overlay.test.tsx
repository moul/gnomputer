import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { act, render, screen, cleanup } from "@testing-library/react";
import { NetworkSwitchOverlay } from "./network-switch-overlay";
import { SdkProvider } from "../sdk-context";
import { useShellStore } from "../store";
import type { GnomputerSDK } from "@gnomputer/app-sdk";

const sdk = {
  networks: {
    getActive: () => ({ id: "betanet", name: "Betanet", shortName: "Betanet" }),
  },
} as unknown as GnomputerSDK;

function renderOverlay() {
  return render(
    <SdkProvider overrideSdk={sdk}>
      <NetworkSwitchOverlay />
    </SdkProvider>
  );
}

/** One deliberate switch, as `activateNetwork()` performs it. */
function beginSwitch() {
  useShellStore.getState().setNetworkSwitching(true);
  useShellStore.getState().noteNetworkSwitch();
}

beforeEach(() => {
  useShellStore.setState({ networkSwitching: false, networkSwitchSeq: 0 });
});

afterEach(cleanup);

describe("NetworkSwitchOverlay", () => {
  it("covers the desktop while the switch is in flight", () => {
    renderOverlay();
    act(() => beginSwitch());

    expect(screen.getByRole("status").textContent).toContain("Switching to Betanet");
  });

  it("still appears when the restore finishes in the same batch that started it", () => {
    // The bug this guards: a layout already in the page cache can restore
    // inside the same React batch that began the switch. A component watching
    // only `networkSwitching` then sees it go true and back to false without
    // ever rendering in between, and the overlay silently never appears — as
    // it did not, in production, while working every time locally.
    renderOverlay();

    act(() => {
      beginSwitch();
      useShellStore.getState().setNetworkSwitching(false);
    });

    expect(screen.queryByRole("status")).not.toBeNull();
  });

  it("shows nothing when no switch has been asked for", () => {
    renderOverlay();

    expect(screen.queryByRole("status")).toBeNull();
  });

  it("does not reappear for a network id settling during boot", () => {
    // `activeNetworkId` also moves once at startup, from the default to
    // whatever was stored. Only a counted switch is a switch.
    renderOverlay();
    act(() => {
      useShellStore.getState().setActiveNetwork("topaz");
    });

    expect(screen.queryByRole("status")).toBeNull();
  });
});
