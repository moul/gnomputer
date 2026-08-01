import { describe, it, expect } from "vitest";
import { menuKeyAction } from "./menu-keys";

const ITEMS = ["Network", "User", "Theme", "About"];

describe("menuKeyAction", () => {
  it("moves down and up", () => {
    expect(menuKeyAction("ArrowDown", ITEMS, 0)).toEqual({ focus: 1 });
    expect(menuKeyAction("ArrowUp", ITEMS, 2)).toEqual({ focus: 1 });
  });

  it("wraps at both ends", () => {
    // A menu is a short closed list, so the APG menu pattern wraps — unlike
    // the docs tree, where wrapping would lose your place in a long
    // structure.
    expect(menuKeyAction("ArrowDown", ITEMS, 3)).toEqual({ focus: 0 });
    expect(menuKeyAction("ArrowUp", ITEMS, 0)).toEqual({ focus: 3 });
  });

  it("jumps to the ends", () => {
    expect(menuKeyAction("Home", ITEMS, 2)).toEqual({ focus: 0 });
    expect(menuKeyAction("End", ITEMS, 0)).toEqual({ focus: 3 });
  });

  it("closes on Escape", () => {
    expect(menuKeyAction("Escape", ITEMS, 1)).toEqual({ close: true });
  });

  it("typeahead searches forward from the current item and wraps", () => {
    expect(menuKeyAction("t", ITEMS, 0)).toEqual({ focus: 2 });
    expect(menuKeyAction("n", ITEMS, 2)).toEqual({ focus: 0 });
  });

  it("cycles through items sharing a first letter on repeat presses", () => {
    const repeated = ["Save", "Save as", "Open"];
    expect(menuKeyAction("s", repeated, 0)).toEqual({ focus: 1 });
    expect(menuKeyAction("s", repeated, 1)).toEqual({ focus: 0 });
  });

  it("ignores leading whitespace in an item's text", () => {
    // Items come from textContent, which picks up JSX indentation.
    expect(menuKeyAction("u", ["  Network  ", "  User  "], 0)).toEqual({ focus: 1 });
  });

  it("returns null for keys it does not own, so Tab keeps working", () => {
    // These items are real buttons in the tab order and always have been;
    // swallowing Tab would be a regression, not an improvement.
    expect(menuKeyAction("Tab", ITEMS, 0)).toBeNull();
    expect(menuKeyAction("Enter", ITEMS, 0)).toBeNull();
    expect(menuKeyAction(" ", ITEMS, 0)).toBeNull();
    expect(menuKeyAction("ArrowLeft", ITEMS, 0)).toBeNull();
  });

  it("returns null for a letter that matches nothing", () => {
    expect(menuKeyAction("z", ITEMS, 0)).toBeNull();
  });

  it("handles an empty menu without throwing", () => {
    expect(menuKeyAction("ArrowDown", [], -1)).toBeNull();
  });

  it("enters the list from outside it", () => {
    // currentIndex is -1 when focus is on the trigger rather than an item.
    expect(menuKeyAction("ArrowDown", ITEMS, -1)).toEqual({ focus: 0 });
    expect(menuKeyAction("ArrowUp", ITEMS, -1)).toEqual({ focus: 3 });
  });
});
