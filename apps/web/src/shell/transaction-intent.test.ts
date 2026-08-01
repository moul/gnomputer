import { describe, it, expect } from "vitest";
import {
  assertChainMatch,
  ChainMismatchError,
  intentToMessage,
  extractTxHash,
  type TransactionIntent,
} from "./transaction-intent";
import type { WalletAccount } from "./wallet-store";

const account: WalletAccount = {
  address: "g1abc",
  chainId: "topaz-1",
  coins: "1000000ugnot",
  source: "adena",
};

const intent: TransactionIntent = {
  summary: "Register the username abc123",
  packagePath: "gno.land/r/gnoland/users/v1",
  func: "Register",
  args: ["abc123"],
  send: "1000000ugnot",
};

describe("assertChainMatch", () => {
  it("allows signing when the wallet and the active network agree", () => {
    expect(() => assertChainMatch(account, "topaz-1")).not.toThrow();
  });

  it("blocks signing when the wallet is on a different chain", () => {
    expect(() => assertChainMatch(account, "portal-loop")).toThrow(ChainMismatchError);
    // The message must name BOTH chains — "wrong network" alone leaves the
    // user with no idea which side to change.
    try {
      assertChainMatch(account, "portal-loop");
    } catch (e) {
      expect((e as Error).message).toContain("topaz-1");
      expect((e as Error).message).toContain("portal-loop");
    }
  });

  it("blocks signing on a custom network whose chain ID is unknown", () => {
    // custom-networks-store assigns "unknown" when it can't discover one;
    // an unknown chain can never be proven to match.
    expect(() => assertChainMatch(account, "unknown")).toThrow(/chain ID is unknown/);
    expect(() => assertChainMatch(account, "")).toThrow(/chain ID is unknown/);
  });
});

describe("intentToMessage", () => {
  it("builds the real /vm.m_call shape the chain expects", () => {
    expect(intentToMessage(intent, account)).toEqual({
      type: "/vm.m_call",
      value: {
        caller: "g1abc",
        send: "1000000ugnot",
        pkg_path: "gno.land/r/gnoland/users/v1",
        func: "Register",
        args: ["abc123"],
      },
    });
  });

  it("sends an empty string, not undefined, when no funds are attached", () => {
    const free = { ...intent, send: undefined };
    expect(intentToMessage(free, account).value.send).toBe("");
  });
});

describe("extractTxHash", () => {
  it("finds the hash across the shapes Adena has used", () => {
    expect(extractTxHash({ hash: "ABC" })).toBe("ABC");
    expect(extractTxHash({ txHash: "DEF" })).toBe("DEF");
    expect(extractTxHash({ tx_hash: "GHI" })).toBe("GHI");
  });

  it("returns undefined rather than throwing when there's no usable hash", () => {
    expect(extractTxHash(undefined)).toBeUndefined();
    expect(extractTxHash(null)).toBeUndefined();
    expect(extractTxHash("nope")).toBeUndefined();
    expect(extractTxHash({})).toBeUndefined();
    expect(extractTxHash({ hash: "" })).toBeUndefined();
  });
});
