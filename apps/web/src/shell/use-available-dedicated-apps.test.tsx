import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { InvalidPkgPathError, type GnomputerSDK } from "@gnomputer/app-sdk";
import { SdkProvider } from "../sdk-context";
import { useAvailableDedicatedApps } from "./use-available-dedicated-apps";

vi.mock("./dedicated-apps", () => ({
  DEDICATED_APPS: [
    { id: "app-a", label: "App A", icon: "🅰️", pkgPath: "gno.land/r/test/a", url: "https://a.example" },
    { id: "app-b", label: "App B", icon: "🅱️", pkgPath: "gno.land/r/test/b", url: "https://b.example" },
  ],
}));

let queryFile: (path: string) => Promise<unknown>;
let queryFileCalls: string[];

function fakeSdk(networkId = "mainnet"): GnomputerSDK {
  return {
    networks: { getActive: () => ({ id: networkId }) },
    rpc: {
      queryFile: (path: string) => {
        queryFileCalls.push(path);
        return queryFile(path);
      },
    },
  } as unknown as GnomputerSDK;
}

let client: QueryClient;

function wrapper(sdk: GnomputerSDK) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <SdkProvider overrideSdk={sdk}>{children}</SdkProvider>
      </QueryClientProvider>
    );
  };
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryFileCalls = [];
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("useAvailableDedicatedApps", () => {
  it("reports nothing while the checks are still pending", () => {
    queryFile = () => new Promise(() => {});
    const { result } = renderHook(() => useAvailableDedicatedApps(), { wrapper: wrapper(fakeSdk()) });
    expect(result.current).toEqual([]);
  });

  it("includes an app once its realm resolves on the active network", async () => {
    queryFile = async (path) => (path === "gno.land/r/test/a" ? "source" : Promise.reject(new Error("boom")));
    const { result } = renderHook(() => useAvailableDedicatedApps(), { wrapper: wrapper(fakeSdk()) });

    await waitFor(() => expect(result.current.map((a) => a.id)).toEqual(["app-a"]));
  });

  it("excludes an app the chain confirms does not exist there", async () => {
    queryFile = async () => {
      throw new InvalidPkgPathError("package not found: gno.land/r/test/a");
    };
    const { result } = renderHook(() => useAvailableDedicatedApps(), { wrapper: wrapper(fakeSdk()) });

    // Both queries settle (rejecting is still settling), so waiting for the
    // call count is a real signal rather than an arbitrary pause.
    await waitFor(() => expect(queryFileCalls.length).toBe(2));
    expect(result.current).toEqual([]);
  });

  it("does not show an app on an inconclusive failure (RPC unreachable)", async () => {
    // A network hiccup is not the same fact as "not deployed here" — it must
    // not be treated as a confirmed absence, but it also must not crash the
    // menu into an error state. The safe default is simply not shown yet.
    queryFile = async () => {
      throw new Error("fetch failed");
    };
    const { result } = renderHook(() => useAvailableDedicatedApps(), { wrapper: wrapper(fakeSdk()) });

    await waitFor(() => expect(queryFileCalls.length).toBe(2));
    expect(result.current).toEqual([]);
  });

  it("checks each app's realm only once per network, not on every render", async () => {
    queryFile = async () => "source";
    const { result, rerender } = renderHook(() => useAvailableDedicatedApps(), {
      wrapper: wrapper(fakeSdk()),
    });

    await waitFor(() => expect(result.current.map((a) => a.id)).toEqual(["app-a", "app-b"]));
    rerender();
    rerender();

    expect(queryFileCalls).toEqual(["gno.land/r/test/a", "gno.land/r/test/b"]);
  });
});
