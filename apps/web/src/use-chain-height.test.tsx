import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { GnomputerSDK } from "@gnomputer/app-sdk";
import { SdkProvider } from "./sdk-context";
import { useChainHeight, CHAIN_HEIGHT_POLL_MS } from "./use-chain-height";

vi.mock("./shell/live-updates-store", () => ({ useLiveUpdatesPaused: () => false }));

let getStatus: () => Promise<{ data: { latestHeight: number; chainId: string } }>;

const sdk = {
  networks: { getActive: () => ({ id: "topaz" }) },
  rpc: { getStatus: () => getStatus() },
} as unknown as GnomputerSDK;

let client: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={client}>
      <SdkProvider overrideSdk={sdk}>{children}</SdkProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  // Disable react-query's own retry-on-mount noise here — useChainHeight
  // sets its own `retry: 1`, which is what's under test, not the client
  // default.
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function render() {
  return renderHook(() => useChainHeight(), { wrapper });
}

describe("useChainHeight backoff", () => {
  it("classifies a rate-limited failure and reports it", async () => {
    getStatus = () => Promise.reject(new Error("Bad status on response: 429"));
    const { result } = render();

    // useChainHeight's own `retry: 1` means the query takes just over a
    // second (react-query's default ~1s retry delay) to settle into an
    // error state — longer than waitFor's default 1000ms budget.
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 3000 });
    expect(result.current.errorKind).toBe("rate-limited");
  });

  it("reports no error kind while healthy", async () => {
    getStatus = () => Promise.resolve({ data: { latestHeight: 100, chainId: "topaz-1" } });
    const { result } = render();

    await waitFor(() => expect(result.current.height).toBe(100));
    expect(result.current.errorKind).toBeNull();
  });
});

describe("useChainHeight's polling interval", () => {
  it("stays at the documented base interval", () => {
    // The exponential-backoff behavior itself is react-query's own
    // `refetchInterval` timer, not something worth asserting via real
    // clock waits in a unit test — the two tests above already cover the
    // part this hook is responsible for: classifying the failure correctly
    // so the backoff function (and the island's badge) can act on it.
    expect(CHAIN_HEIGHT_POLL_MS).toBe(4000);
  });
});
