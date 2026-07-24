import { describe, it, expect } from "vitest";
import { isRealmTab, filterValidRealmTabWindows } from "./use-realm-tabs-persistence";
import type { RealmTab } from "./realm-tabs-store";

function validTab(overrides: Partial<RealmTab> = {}): RealmTab {
  return { id: "tab-1", packagePath: "gno.land/r/demo/foo", renderPath: "", lens: "render", ...overrides };
}

describe("isRealmTab", () => {
  it("accepts a well-formed tab", () => {
    expect(isRealmTab(validTab())).toBe(true);
  });

  it("rejects null and non-objects", () => {
    expect(isRealmTab(null)).toBe(false);
    expect(isRealmTab("tab")).toBe(false);
  });

  it("rejects a tab with a lens that isn't a known RealmLens value", () => {
    expect(isRealmTab({ ...validTab(), lens: "not-a-real-lens" })).toBe(false);
  });

  it("rejects a tab missing a required field", () => {
    const withoutPackagePath: Record<string, unknown> = validTab();
    delete withoutPackagePath.packagePath;
    expect(isRealmTab(withoutPackagePath)).toBe(false);
  });
});

describe("filterValidRealmTabWindows", () => {
  it("keeps a window whose every tab is valid and drops one with any invalid tab", () => {
    const parsed = {
      good: { activeTabId: "tab-1", tabs: [validTab()] },
      bad: { activeTabId: "tab-2", tabs: [validTab({ id: "tab-2", lens: "bogus" as never })] },
    };
    expect(filterValidRealmTabWindows(parsed)).toEqual({
      good: { activeTabId: "tab-1", tabs: [validTab()] },
    });
  });

  it("drops a window missing activeTabId or with a non-array tabs field", () => {
    const parsed = {
      noActiveId: { tabs: [validTab()] },
      tabsNotArray: { activeTabId: "tab-1", tabs: "nope" },
    };
    expect(filterValidRealmTabWindows(parsed)).toEqual({});
  });

  it("returns an empty object for non-object input instead of throwing", () => {
    expect(filterValidRealmTabWindows(null)).toEqual({});
    expect(filterValidRealmTabWindows(undefined)).toEqual({});
    expect(filterValidRealmTabWindows("garbage")).toEqual({});
  });
});
