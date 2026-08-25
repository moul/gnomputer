import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import type { GnomputerSDK } from "@gnomputer/app-sdk";
import { SdkProvider } from "../sdk-context";
import { useShellStore } from "../store";
import { useRealmTabsStore } from "./realm-tabs-store";
import { useRealmTabsPersistence } from "./use-realm-tabs-persistence";

vi.mock("../routes/root", () => ({ router: { navigate: vi.fn() } }));

/** A saved tab set for a different realm than the one the URL names. */
const SAVED = JSON.stringify({
  windows: {
    realm: {
      tabs: [{ id: "tab-1", packagePath: "gno.land/r/saved", renderPath: "", lens: "render" }],
      activeTabId: "tab-1",
    },
  },
  extraWindowIds: [],
});

/**
 * An SDK whose stored-state reads resolve only when told to.
 *
 * This is the whole point of the test. Restoration is asynchronous, and which
 * side of the race you land on decides which of two bugs you get — but neither
 * a browser nor Playwright lets you choose. Here the resolution is explicit.
 */
function deferredSdk() {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  // Restoration ends by flushing the settled state back, so a write is the
  // signal that it has finished. Without waiting for it, an assertion about
  // the tabs passes against the state *before* the restore lands — which is
  // how the first version of this test passed with the fix reverted.
  const writes: string[] = [];
  const sdk = {
    uiState: {
      get: async (key: string) => {
        await gate;
        return key.startsWith("realm-tabs") ? SAVED : null;
      },
      set: async (key: string) => {
        writes.push(key);
      },
      keys: async () => [],
      remove: async () => {},
    },
  } as unknown as GnomputerSDK;
  return { sdk, release: () => release(), writes };
}

function Harness({ children }: { children?: ReactNode }) {
  useRealmTabsPersistence();
  return <>{children}</>;
}

beforeEach(() => {
  useShellStore.setState({ activeNetworkId: "sapphire", networkSwitchSeq: 0 });
  useRealmTabsStore.setState({
    windows: {},
    extraWindowIds: [],
    nextTabSeq: 1,
    nextWindowSeq: 1,
    urlSeeded: {},
  });
});

afterEach(cleanup);

describe("restoring tabs against a URL that already named a realm", () => {
  it("leaves the realm a link named, even when the restore lands afterwards", async () => {
    // The bug: restoration merges saved windows over the store, including the
    // tab the URL had just set. When it landed late it won, so a shared link
    // opened the recipient's own last-used realm under the linked realm's
    // title, with no error. Anyone who had ever opened a realm was affected;
    // only a first-ever visit worked.
    const { sdk, release, writes } = deferredSdk();

    // What RealmBrowser does on mount for `?pkg=gno.land/r/linked`.
    useRealmTabsStore.getState().ensureWindow("realm");
    useRealmTabsStore.getState().updateActiveTab("realm", {
      packagePath: "gno.land/r/linked",
      renderPath: "",
      lens: "render",
    });
    useRealmTabsStore.getState().markUrlSeeded("realm");

    render(
      <SdkProvider overrideSdk={sdk}>
        <Harness />
      </SdkProvider>
    );

    // Restoration resolves only now — after the URL has been applied.
    release();
    await waitFor(() => expect(writes.length).toBeGreaterThan(0));

    const win = useRealmTabsStore.getState().windows.realm!;
    expect(win.tabs[0]!.packagePath).toBe("gno.land/r/linked");
  });

  it("still restores a window the URL said nothing about", async () => {
    // The other half: deferring to the URL must not turn restoration off.
    const { sdk, release, writes } = deferredSdk();

    useRealmTabsStore.getState().ensureWindow("realm");

    render(
      <SdkProvider overrideSdk={sdk}>
        <Harness />
      </SdkProvider>
    );
    release();
    await waitFor(() => expect(writes.length).toBeGreaterThan(0));

    const win = useRealmTabsStore.getState().windows.realm!;
    expect(win.tabs[0]!.packagePath).toBe("gno.land/r/saved");
  });
});
