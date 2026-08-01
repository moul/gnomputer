import "fake-indexeddb/auto";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, within, fireEvent } from "@testing-library/react";
import { TransactionReview } from "./transaction-review";
import type { TransactionIntent } from "./transaction-intent";
import type { WalletAccount } from "./wallet-store";

afterEach(cleanup);

const account: WalletAccount = {
  address: "g1abcdef",
  chainId: "topaz-1",
  coins: "5000000ugnot",
  source: "adena",
};

const intent: TransactionIntent = {
  summary: 'Register the username "abc123"',
  packagePath: "gno.land/r/gnoland/users/v1",
  func: "Register",
  args: ["abc123"],
  send: "1000000ugnot",
  sendReason: "the registry's fixed registration price",
};

function renderReview(over: Partial<Parameters<typeof TransactionReview>[0]> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  const onDismiss = vi.fn();
  const utils = render(
    <TransactionReview
      state={{ phase: "review", intent }}
      account={account}
      networkChainId="topaz-1"
      onConfirm={onConfirm}
      onCancel={onCancel}
      onDismiss={onDismiss}
      {...over}
    />
  );
  return { ...utils, onConfirm, onCancel, onDismiss };
}

describe("TransactionReview", () => {
  it("shows every fact a user needs before approving a fund-moving call", () => {
    const { container } = renderReview();
    const text = container.textContent ?? "";
    expect(text).toContain("topaz-1"); // which chain
    expect(text).toContain("g1abcdef"); // which account
    expect(text).toContain("gno.land/r/gnoland/users/v1"); // which realm
    expect(text).toContain("Register(abc123)"); // what call
    expect(text).toContain("1 GNOT"); // how much money
    expect(text).toContain("registration price"); // and why
  });

  it("does not request a signature until the user approves", () => {
    const { container, onConfirm } = renderReview();
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(within(container).getByRole("button", { name: /Approve in wallet/ }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("cancelling never requests a signature", () => {
    const { container, onConfirm, onCancel } = renderReview();
    fireEvent.click(within(container).getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("says 'Nothing' rather than leaving the amount blank when no funds move", () => {
    const { container } = renderReview({
      state: { phase: "review", intent: { ...intent, send: undefined } },
    });
    expect(container.textContent).toContain("Nothing");
  });

  it("distinguishes submitted from confirmed — wallet success is not on-chain success", () => {
    const submitted = renderReview({ state: { phase: "submitted", intent, hash: "ABC" } });
    expect(submitted.container.textContent).toMatch(/waiting for it to be included/i);
    cleanup();
    const confirmed = renderReview({ state: { phase: "confirmed", intent, hash: "ABC" } });
    expect(confirmed.container.textContent).toMatch(/Confirmed on chain/i);
  });

  it("reports failure as an alert", () => {
    const { container } = renderReview({
      state: { phase: "failed", intent, error: "Wallet is on the wrong chain" },
    });
    const alert = within(container).getByRole("alert");
    expect(alert.textContent).toContain("wrong chain");
  });

  it("renders nothing when idle", () => {
    const { container } = renderReview({ state: { phase: "idle" } });
    expect(container.textContent).toBe("");
  });
});
