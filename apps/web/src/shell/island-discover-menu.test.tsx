import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { InvalidPkgPathError, type GnomputerSDK } from "@gnomputer/app-sdk";
import { SdkProvider } from "../sdk-context";
import { IslandDiscoverMenu } from "./island-discover-menu";

vi.mock("./dedicated-apps", () => ({
  DEDICATED_APPS: [
    { id: "kourt", label: "Kourt", icon: "⚖️", pkgPath: "gno.land/r/court", url: "https://kourt.example" },
  ],
}));

const openDedicatedApp = vi.fn();
vi.mock("./open-dedicated-app", () => ({ openDedicatedApp: (id: string) => openDedicatedApp(id) }));

let queryFile: (path: string) => Promise<unknown>;
let queryFileCalls: number;
let client: QueryClient;

function fakeSdk(): GnomputerSDK {
  return {
    networks: {
      getActive: () => ({
        id: "mainnet",
        name: "Mainnet",
        chainId: "gnoland-1",
        rpcUrl: "https://rpc.example",
        environment: "mainnet",
        persistence: "persistent",
        trust: "official",
        capabilities: [],
      }),
    },
    rpc: {
      queryFile: (path: string) => {
        queryFileCalls++;
        return queryFile(path);
      },
    },
  } as unknown as GnomputerSDK;
}

function renderMenu() {
  return render(
    <QueryClientProvider client={client}>
      <SdkProvider overrideSdk={fakeSdk()}>
        <IslandDiscoverMenu />
      </SdkProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  openDedicatedApp.mockClear();
  queryFileCalls = 0;
});

afterEach(() => {
  cleanup();
});

describe("IslandDiscoverMenu", () => {
  it("does not show a dedicated app's entry while its realm check is pending", () => {
    queryFile = () => new Promise(() => {});
    renderMenu();
    expect(screen.queryByRole("button", { name: /Kourt/ })).toBeNull();
  });

  it("shows a dedicated app's entry once its realm is confirmed on the active network", async () => {
    queryFile = async () => "source";
    renderMenu();

    const button = await screen.findByRole("button", { name: /Kourt/ });
    button.click();
    expect(openDedicatedApp).toHaveBeenCalledWith("kourt");
  });

  it("never shows a dedicated app's entry when the realm does not exist on this chain", async () => {
    queryFile = async () => {
      throw new InvalidPkgPathError();
    };
    renderMenu();

    // Wait for the query to actually resolve to "confirmed absent" before
    // asserting the button is gone — otherwise a "not shown yet" pass could
    // just mean "still pending", which is a different, weaker guarantee.
    await waitFor(() =>
      expect(client.getQueryData(["dedicated-app-exists", "mainnet", "gno.land/r/court"])).toBe(
        false
      )
    );
    expect(queryFileCalls).toBe(1);
    expect(screen.queryByRole("button", { name: /Kourt/ })).toBeNull();
  });
});
