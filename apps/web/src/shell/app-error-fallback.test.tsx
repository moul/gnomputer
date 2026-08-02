import "fake-indexeddb/auto";
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, within, fireEvent } from "@testing-library/react";
import { AppErrorFallback } from "./app-error-fallback";
import { USER_CONTENT_STORES } from "./local-data-recovery";

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
    expect(text).toMatch(/keeps.*scripts, Trails and favorites/s);
    // Favorites belong in that list now that a UI can create them (#171).
    // Workspaces never could, and the store is gone as of the v4 schema, so
    // naming them here would promise to preserve something that cannot
    // exist — on the one screen where someone is deciding whether to erase
    // (AUD-044).
    expect(text).not.toMatch(/workspaces/i);
  });

  it("names exactly the stores a scoped reset actually protects", () => {
    // The copy and USER_CONTENT_STORES drifted apart once before, in both
    // directions: the screen promised favorites and workspaces nothing
    // could create, and later kept quiet about favorites after they
    // shipped. Tying the assertion to the constant makes the next drift a
    // test failure instead of a false promise.
    const { container } = render(<AppErrorFallback error={err} />);
    const text = (container.textContent ?? "").toLowerCase();
    const named = { scripts: "scripts", trails: "trails", trailSteps: "trails", favorites: "favorites" };
    for (const store of USER_CONTENT_STORES) {
      expect(text, `recovery copy should name "${store}"`).toContain(named[store]);
    }
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
