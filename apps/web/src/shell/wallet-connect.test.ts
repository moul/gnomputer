import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GnomputerSDK } from "@gnomputer/app-sdk";
import {
  ADENA_INSTALL_URL,
  connectManualAddress,
  connectWallet,
  disconnectWallet,
  initWalletListeners,
  isAdenaInstalled,
} from "./wallet-connect";
import { useWalletStore } from "./wallet-store";

// A real Topaz address, checksum included: isValidGnoAddress does a bech32
// decode, so a made-up g1… string would be rejected for the right reason
// and prove nothing about the paths under test.
const VALID = "g1manfred47kzduec920z88wfr64ylksmdcedlf5";

function sdkWith(getAccountInfo: () => Promise<{ data: { balance: string } }>): GnomputerSDK {
  return {
    rpc: { getAccountInfo },
    networks: { getActive: () => ({ chainId: "test13" }) },
  } as unknown as GnomputerSDK;
}

function setAdena(value: unknown) {
  Object.defineProperty(window, "adena", { value, configurable: true, writable: true });
}

beforeEach(() => {
  useWalletStore.setState({ account: null, connecting: false, error: null });
  setAdena(undefined);
});

afterEach(() => vi.restoreAllMocks());

describe("isAdenaInstalled", () => {
  it("is false with no extension and true with one", () => {
    expect(isAdenaInstalled()).toBe(false);
    setAdena({});
    expect(isAdenaInstalled()).toBe(true);
  });
});

describe("connectWallet", () => {
  it("sends you to install Adena instead of failing silently", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    await connectWallet();
    expect(open).toHaveBeenCalledWith(ADENA_INSTALL_URL, "_blank", "noopener,noreferrer");
    expect(useWalletStore.getState().account).toBeNull();
    // Nothing was attempted, so nothing should be reported as broken.
    expect(useWalletStore.getState().error).toBeNull();
  });

  it("stores the account Adena returns", async () => {
    setAdena({
      AddEstablish: () => Promise.resolve(),
      GetAccount: () =>
        Promise.resolve({ status: "success", data: { address: VALID, chainId: "test13", coins: "42ugnot" } }),
    });

    await connectWallet();

    expect(useWalletStore.getState().account).toEqual({
      address: VALID,
      chainId: "test13",
      coins: "42ugnot",
      source: "adena",
    });
    expect(useWalletStore.getState().connecting).toBe(false);
  });

  it("reports a non-success status rather than connecting to nothing", async () => {
    setAdena({
      AddEstablish: () => Promise.resolve(),
      GetAccount: () => Promise.resolve({ status: "failure", data: {} }),
    });

    await connectWallet();

    expect(useWalletStore.getState().account).toBeNull();
    expect(useWalletStore.getState().error).toMatch(/did not return an account/i);
  });

  it("clears the connecting flag when the handshake throws", async () => {
    // Without the finally, a rejected AddEstablish leaves the button
    // spinning forever with no way back.
    setAdena({
      AddEstablish: () => Promise.reject(new Error("user rejected")),
      GetAccount: () => Promise.resolve({ status: "success", data: {} }),
    });

    await connectWallet();

    expect(useWalletStore.getState().connecting).toBe(false);
    expect(useWalletStore.getState().error).toBe("user rejected");
  });
});

describe("connectManualAddress", () => {
  it("refuses an address that fails its checksum", async () => {
    // Shape-only validation accepted this (AUD-031); a real bech32 decode
    // does not. The last character is altered from a valid address.
    const getAccountInfo = vi.fn();
    await connectManualAddress(sdkWith(getAccountInfo), "g1manfred47kzduec920z88wfr64ylksmdcedlf6");

    expect(getAccountInfo).not.toHaveBeenCalled();
    expect(useWalletStore.getState().account).toBeNull();
    expect(useWalletStore.getState().error).toMatch(/doesn't look like a Gno address/i);
  });

  it("refuses an empty or whitespace address without calling the chain", async () => {
    const getAccountInfo = vi.fn();
    await connectManualAddress(sdkWith(getAccountInfo), "   ");
    expect(getAccountInfo).not.toHaveBeenCalled();
    expect(useWalletStore.getState().error).toBeTruthy();
  });

  it("looks up the real balance and marks the identity as manual", async () => {
    // "manual" is load-bearing: it is how the rest of the app knows this
    // identity cannot sign, and must fall back to a gnokey TxLink.
    const getAccountInfo = vi.fn(() => Promise.resolve({ data: { balance: "100ugnot" } }));
    await connectManualAddress(sdkWith(getAccountInfo), `  ${VALID}  `);

    expect(getAccountInfo).toHaveBeenCalledWith(VALID, expect.any(String));
    expect(useWalletStore.getState().account).toEqual({
      address: VALID,
      chainId: "test13",
      coins: "100ugnot",
      source: "manual",
    });
  });

  it("reports a failed lookup instead of storing an account with no balance", async () => {
    await connectManualAddress(
      sdkWith(() => Promise.reject(new Error("chain unreachable"))),
      VALID
    );
    expect(useWalletStore.getState().account).toBeNull();
    expect(useWalletStore.getState().error).toBe("chain unreachable");
    expect(useWalletStore.getState().connecting).toBe(false);
  });
});

describe("disconnectWallet", () => {
  it("drops the account and clears any error with it", () => {
    useWalletStore.setState({
      account: { address: VALID, chainId: "test13", coins: "1", source: "adena" },
      error: "stale",
      connecting: false,
    });
    disconnectWallet();
    expect(useWalletStore.getState().account).toBeNull();
    expect(useWalletStore.getState().error).toBeNull();
  });
});

describe("initWalletListeners", () => {
  it("is a harmless no-op with no extension", () => {
    expect(() => initWalletListeners()()).not.toThrow();
  });

  it("does not surface an error when this origin was never connected", async () => {
    // The common case on a first visit. Showing "could not connect" to
    // someone who never asked to would be noise, not information.
    setAdena({
      GetAccount: () => Promise.reject(new Error("not established")),
      On: vi.fn(),
      Off: vi.fn(),
    });

    initWalletListeners();
    await Promise.resolve();
    await Promise.resolve();

    expect(useWalletStore.getState().error).toBeNull();
    expect(useWalletStore.getState().account).toBeNull();
  });

  it("follows an account switch in the extension", async () => {
    let handler: (() => void) | undefined;
    let current = VALID;
    setAdena({
      GetAccount: () =>
        Promise.resolve({ status: "success", data: { address: current, chainId: "test13", coins: "1" } }),
      On: (_event: string, fn: () => void) => (handler = fn),
      Off: vi.fn(),
    });

    initWalletListeners();
    await vi.waitFor(() => expect(useWalletStore.getState().account?.address).toBe(VALID));

    current = "g1jg8mtutu9khhfwc4nxmuhcpftf0pajdhfvsqf5";
    handler!();
    await vi.waitFor(() => expect(useWalletStore.getState().account?.address).toBe(current));
  });

  it("unsubscribes what it subscribed", () => {
    const Off = vi.fn();
    setAdena({ GetAccount: () => Promise.resolve({ status: "failure" }), On: vi.fn(), Off });
    initWalletListeners()();
    expect(Off).toHaveBeenCalledWith("changedAccount", expect.any(Function));
  });
});
