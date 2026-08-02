import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import type { GnomputerSDK } from "@gnomputer/app-sdk";
import { SdkProvider } from "../sdk-context";
import { useShellStore } from "../store";
import { useFavorites, useFavoritesStore } from "./favorites-store";

afterEach(() => {
  cleanup();
  useFavoritesStore.setState({ favorites: [], hydrated: false });
});

function wrapperFor(sdk: GnomputerSDK) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <SdkProvider overrideSdk={sdk}>{children}</SdkProvider>;
  };
}

function sdkWithList(list: () => Promise<unknown>): GnomputerSDK {
  return {
    favorites: { list, set: () => Promise.resolve() },
    networks: { getActive: () => ({ id: "topaz" }) },
  } as unknown as GnomputerSDK;
}

describe("useFavorites hydration", () => {
  it("loads the stored list", async () => {
    const rows = [{ refUri: "gno://topaz/realm/r/x", label: "X", createdAt: "1" }];
    const { result } = renderHook(() => useFavorites(), {
      wrapper: wrapperFor(sdkWithList(() => Promise.resolve(rows))),
    });
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.favorites).toEqual(rows);
  });

  it("treats a rejected read as an empty list", async () => {
    const { result } = renderHook(() => useFavorites(), {
      wrapper: wrapperFor(sdkWithList(() => Promise.reject(new Error("closed")))),
    });
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.favorites).toEqual([]);
  });

  it("survives a read that throws synchronously", async () => {
    // Where IndexedDB is blocked outright — Firefox private browsing, a
    // locked-down enterprise profile — reading `window.indexedDB` throws
    // rather than returning something that rejects, so list() throws before
    // there is a promise to attach a rejection handler to. Handled with
    // .then(ok, err) instead of try/catch, this escaped the effect into the
    // error boundary and put a crash screen on a browser the app otherwise
    // runs on fine.
    const list = vi.fn(() => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    }) as unknown as () => Promise<never>;

    const { result } = renderHook(() => useFavorites(), {
      wrapper: wrapperFor(sdkWithList(list)),
    });

    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.favorites).toEqual([]);
  });

  it("reads storage once even when several components ask", async () => {
    const list = vi.fn(() => Promise.resolve([]));
    const sdk = sdkWithList(list);
    const wrapper = wrapperFor(sdk);
    const a = renderHook(() => useFavorites(), { wrapper });
    await waitFor(() => expect(a.result.current.hydrated).toBe(true));
    renderHook(() => useFavorites(), { wrapper });
    renderHook(() => useFavorites(), { wrapper });
    expect(list).toHaveBeenCalledTimes(1);
  });
});

describe("useFavorites and network switches", () => {
  it("re-reads the network when the active one changes", async () => {
    // sdk.networks.getActive() is a plain object React cannot observe, so
    // reading only from it left the star showing a Topaz favourite as
    // starred after a switch to betanet — the component simply never
    // re-rendered. The hook subscribes to the shell store's mirror of the
    // same choice to get the invalidation.
    let active = "topaz";
    const sdk = {
      favorites: { list: () => Promise.resolve([]), set: () => Promise.resolve() },
      networks: { getActive: () => ({ id: active }) },
    } as unknown as GnomputerSDK;

    const { result } = renderHook(() => useFavorites(), { wrapper: wrapperFor(sdk) });
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.networkId).toBe("topaz");

    active = "betanet";
    act(() => useShellStore.setState({ activeNetworkId: "betanet" }));

    expect(result.current.networkId).toBe("betanet");
  });
});
