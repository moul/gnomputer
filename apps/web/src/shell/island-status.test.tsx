import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import type { ReactNode } from "react";
import type { GnomputerSDK } from "@gnomputer/app-sdk";
import { SdkProvider } from "../sdk-context";

const online = vi.hoisted(() => ({ current: true }));
vi.mock("./use-online-status", () => ({ useOnlineStatus: () => online.current }));
const chainHeight = vi.hoisted(() => ({
  current: { height: 425330 as number | null, isError: false, dataUpdatedAt: 0 },
}));
vi.mock("../use-chain-height", () => ({
  useChainHeight: () => chainHeight.current,
  CHAIN_HEIGHT_POLL_MS: 4000,
}));

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
  // Fetched just now: the default is a healthy, live height.
  chainHeight.current = { height: 425330, isError: false, dataUpdatedAt: Date.now() };
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

describe("IslandStatus height staleness", () => {
  const STALE_AGO = 60_000;

  it("marks the height when the chain has stopped answering", () => {
    // The bug: useChainHeight reports success for as long as it holds data, so
    // a poll failing for twenty minutes still rendered a confident number
    // while the Network Monitor beside it correctly warned "Updated 20m ago".
    // Reproduced by getting rate-limited by a public RPC — every request
    // failing, navigator.onLine still true, the clock still "connected".
    chainHeight.current = { height: 425330, isError: false, dataUpdatedAt: Date.now() - STALE_AGO };
    const { container } = render(<IslandStatus />, { wrapper });

    const item = container.querySelector(".island__status-item--height")!;
    expect(item.getAttribute("data-stale")).toBe("true");
    // The number is still shown — it is the best available, just not current.
    expect(item.textContent).toContain("#425,330");
    // And a screen reader is told so, not only sighted users via colour.
    expect(item.textContent).toContain("last known, not current");
    expect(item.getAttribute("title")).toMatch(/has not answered/);
  });

  it("says nothing while the chain is answering", () => {
    const { container } = render(<IslandStatus />, { wrapper });
    const item = container.querySelector(".island__status-item--height")!;
    expect(item.getAttribute("data-stale")).toBeNull();
    expect(item.textContent).not.toContain("last known");
  });

  it("stays quiet when the user paused polling", () => {
    // The height is deliberately frozen and the Paused badge already says so.
    // Warning about a state someone chose is noise.
    useLiveUpdatesStore.setState({ lowData: true });
    chainHeight.current = { height: 425330, isError: false, dataUpdatedAt: Date.now() - STALE_AGO };
    const { container } = render(<IslandStatus />, { wrapper });
    expect(container.querySelector(".island__status-item--height")!.getAttribute("data-stale")).toBeNull();
  });

  it("stays quiet when the browser itself is offline", () => {
    // Same reasoning: the Offline badge covers it, and the cause is different.
    online.current = false;
    chainHeight.current = { height: 425330, isError: false, dataUpdatedAt: Date.now() - STALE_AGO };
    const { container } = render(<IslandStatus />, { wrapper });
    expect(container.querySelector(".island__status-item--height")!.getAttribute("data-stale")).toBeNull();
  });

  it("says nothing before the first successful fetch", () => {
    // dataUpdatedAt is 0 then, and epoch-zero must not read as "very stale".
    chainHeight.current = { height: null, isError: false, dataUpdatedAt: 0 };
    const { container } = render(<IslandStatus />, { wrapper });
    const item = container.querySelector(".island__status-item--height")!;
    expect(item.getAttribute("data-stale")).toBeNull();
    expect(item.textContent).toContain("—");
  });
});
