import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import type { ReactNode } from "react";
import type { GnomputerSDK } from "@gnomputer/app-sdk";
import { SdkProvider } from "../sdk-context";

const online = vi.hoisted(() => ({ current: true }));
vi.mock("./use-online-status", () => ({ useOnlineStatus: () => online.current }));
vi.mock("../use-chain-height", () => ({ useChainHeight: () => ({ height: 425330, isError: false }) }));

const { IslandStatus } = await import("./island-status");
const { useLiveUpdatesStore } = await import("./live-updates-store");
const { useWalletStore } = await import("./wallet-store");

const sdk = {
  networks: { getActive: () => ({ id: "topaz", name: "Topaz", rpcUrl: "https://rpc.example" }) },
} as unknown as GnomputerSDK;

function wrapper({ children }: { children: ReactNode }) {
  return <SdkProvider overrideSdk={sdk}>{children}</SdkProvider>;
}

beforeEach(() => {
  online.current = true;
  useLiveUpdatesStore.setState({ lowData: false });
  useWalletStore.setState({ account: null, connecting: false, error: null });
});

afterEach(cleanup);

describe("IslandStatus", () => {
  it("shows no badge when online and polling", () => {
    const { container } = render(<IslandStatus />, { wrapper });
    expect(container.querySelector(".island__status-badge")).toBeNull();
    expect(container.textContent).toContain("#425,330");
  });

  it("shows Paused when the user turned polling off", () => {
    useLiveUpdatesStore.setState({ lowData: true });
    const { container } = render(<IslandStatus />, { wrapper });
    const badge = container.querySelector(".island__status-badge");
    expect(badge?.getAttribute("data-kind")).toBe("low-data");
    expect(badge?.textContent).toBe("Paused");
  });

  it("shows Offline when the network went away", () => {
    online.current = false;
    const { container } = render(<IslandStatus />, { wrapper });
    const badge = container.querySelector(".island__status-badge");
    expect(badge?.getAttribute("data-kind")).toBe("offline");
    expect(badge?.textContent).toBe("Offline");
  });

  it("prefers Offline over Paused when both are true", () => {
    // One of these the user chose and can undo; the other happened to them.
    // Telling someone in a tunnel they are in low-data mode answers a
    // question they did not ask — and two badges would be worse still.
    online.current = false;
    useLiveUpdatesStore.setState({ lowData: true });
    const { container } = render(<IslandStatus />, { wrapper });
    const badges = container.querySelectorAll(".island__status-badge");
    expect(badges).toHaveLength(1);
    expect(badges[0]!.getAttribute("data-kind")).toBe("offline");
  });

  it("keeps showing the height while paused", () => {
    // Blanking it would make every view that reads the height look broken
    // rather than frozen, and it is the number that says how stale the rest
    // of the screen is.
    useLiveUpdatesStore.setState({ lowData: true });
    const { container } = render(<IslandStatus />, { wrapper });
    expect(container.textContent).toContain("#425,330");
  });

  it("shows Guest with no account, and a shortened address with one", () => {
    const { container, unmount } = render(<IslandStatus />, { wrapper });
    expect(container.textContent).toContain("Guest");
    unmount();

    useWalletStore.setState({
      account: {
        address: "g1manfred47kzduec920z88wfr64ylksmdcedlf5",
        chainId: "topaz-1",
        coins: "1ugnot",
        source: "adena",
      },
      connecting: false,
      error: null,
    });
    const second = render(<IslandStatus />, { wrapper });
    expect(second.container.textContent).toContain("g1manf…dlf5");
    expect(second.container.textContent).not.toContain("Guest");
  });
});
