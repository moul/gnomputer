import { describe, it, expect, vi } from "vitest";
import { focusFamilyOrOpenDefault, realmFamilyIds } from "./focus-family";
import type { WindowRecord } from "./window-store";

function win(overrides: Partial<WindowRecord> = {}): WindowRecord {
  return {
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    title: "",
    zIndex: 1,
    closed: false,
    maximized: false,
    preMaximizeGeometry: null,
    ...overrides,
  };
}

describe("focusFamilyOrOpenDefault", () => {
  it("focuses the highest-zIndex open member of the family", () => {
    const windows = {
      a: win({ zIndex: 2 }),
      b: win({ zIndex: 5 }),
      c: win({ zIndex: 3 }),
    };
    const focus = vi.fn();
    const reopen = vi.fn();

    const result = focusFamilyOrOpenDefault(["a", "b", "c"], "default-id", windows, { focus, reopen });

    expect(result).toBe("b");
    expect(focus).toHaveBeenCalledWith("b");
    expect(reopen).not.toHaveBeenCalled();
  });

  it("skips closed members when picking the most-recently-focused one", () => {
    const windows = {
      a: win({ zIndex: 9, closed: true }),
      b: win({ zIndex: 1 }),
    };
    const focus = vi.fn();
    const reopen = vi.fn();

    const result = focusFamilyOrOpenDefault(["a", "b"], "default-id", windows, { focus, reopen });

    expect(result).toBe("b");
    expect(focus).toHaveBeenCalledWith("b");
  });

  it("opens the default id when no family member is open", () => {
    const windows = { a: win({ closed: true }) };
    const focus = vi.fn();
    const reopen = vi.fn();

    const result = focusFamilyOrOpenDefault(["a"], "default-id", windows, { focus, reopen });

    expect(result).toBe("default-id");
    expect(reopen).toHaveBeenCalledWith("default-id");
    expect(focus).not.toHaveBeenCalled();
  });

  it("opens the default id when the family has no windows at all yet", () => {
    const focus = vi.fn();
    const reopen = vi.fn();

    const result = focusFamilyOrOpenDefault(["a", "b"], "default-id", {}, { focus, reopen });

    expect(result).toBe("default-id");
    expect(reopen).toHaveBeenCalledWith("default-id");
  });
});

describe("realmFamilyIds", () => {
  it("includes the primary realm window and any realm-<n> pop-out windows", () => {
    const windows = {
      realm: win(),
      "realm-1": win(),
      "realm-2": win(),
      users: win(),
      settings: win(),
    };
    expect(realmFamilyIds(windows).sort()).toEqual(["realm", "realm-1", "realm-2"]);
  });

  it("returns an empty array when there are no realm windows", () => {
    expect(realmFamilyIds({ users: win() })).toEqual([]);
  });
});
