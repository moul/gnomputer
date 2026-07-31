import "fake-indexeddb/auto";
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, within, fireEvent } from "@testing-library/react";
import { AppErrorFallback } from "./app-error-fallback";

// No global setupFiles in this project, so unmount explicitly — otherwise
// each render() stacks another copy into document.body and role queries
// start matching several elements.
afterEach(cleanup);

describe("AppErrorFallback recovery contract", () => {
  const err = new Error("boom");

  it("offers a non-destructive Reload as the primary action", () => {
    const { container } = render(<AppErrorFallback error={err} />);
    const primary = within(container).getByRole("button", { name: "Reload" });
    expect(primary.className).toContain("app-error__primary");
  });

  it("offers a scoped reset that promises to keep user content", () => {
    const { container } = render(<AppErrorFallback error={err} />);
    expect(within(container).getByRole("button", { name: /Reset layout & cached data/ })).toBeTruthy();
    // The old copy claimed the (whole-database) wipe "only clears local
    // settings/layout". Assert we no longer make that false claim, and that
    // we now explicitly name what is preserved.
    const text = container.textContent ?? "";
    expect(text).not.toContain("This only clears local settings/layout");
    expect(text).toMatch(/keeps.*scripts, Trails, favorites and workspaces/s);
  });

  it("keeps the destructive action behind a second confirm", () => {
    const { container } = render(<AppErrorFallback error={err} />);
    const scoped = within(container);
    // Not immediately clickable — the first button only arms the confirm.
    expect(scoped.queryByRole("button", { name: /Yes, erase everything/ })).toBeNull();

    // fireEvent (not a raw .click()) so React flushes the state update.
    fireEvent.click(scoped.getByRole("button", { name: /Erase all local data/ }));
    expect(scoped.getByRole("button", { name: /Yes, erase everything/ })).toBeTruthy();
  });

  it("warns that erasing destroys scripts and Trails, and offers an export first", () => {
    const { container } = render(<AppErrorFallback error={err} />);
    const text = container.textContent ?? "";
    expect(text).toMatch(/saved Editor scripts/);
    expect(text).toMatch(/cannot be undone/);
    expect(within(container).getByRole("button", { name: /Export my data/ })).toBeTruthy();
  });
});
