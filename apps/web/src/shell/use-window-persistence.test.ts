import { describe, it, expect } from "vitest";
import { isWindowRecord, filterValidWindows } from "./use-window-persistence";
import type { WindowRecord } from "./window-store";

function validRecord(overrides: Partial<WindowRecord> = {}): WindowRecord {
  return {
    x: 0,
    y: 0,
    width: 400,
    height: 300,
    title: "Alpha",
    zIndex: 1,
    closed: false,
    maximized: false,
    preMaximizeGeometry: null,
    ...overrides,
  };
}

describe("isWindowRecord", () => {
  it("accepts a well-formed record", () => {
    expect(isWindowRecord(validRecord())).toBe(true);
  });

  it("rejects null, arrays, and non-objects", () => {
    expect(isWindowRecord(null)).toBe(false);
    expect(isWindowRecord([])).toBe(false);
    expect(isWindowRecord("a window")).toBe(false);
    expect(isWindowRecord(42)).toBe(false);
  });

  it("rejects a record missing a required field", () => {
    const withoutTitle: Record<string, unknown> = validRecord();
    delete withoutTitle.title;
    expect(isWindowRecord(withoutTitle)).toBe(false);
  });

  it("rejects a record with a field of the wrong type (schema drift)", () => {
    expect(isWindowRecord({ ...validRecord(), closed: "false" })).toBe(false);
    expect(isWindowRecord({ ...validRecord(), zIndex: "1" })).toBe(false);
  });
});

describe("filterValidWindows", () => {
  it("keeps only entries that pass isWindowRecord, dropping malformed ones", () => {
    const parsed = {
      good: validRecord({ title: "Good" }),
      bad: { title: "Bad", x: 0 }, // missing most fields
    };
    expect(filterValidWindows(parsed)).toEqual({ good: validRecord({ title: "Good" }) });
  });

  it("returns an empty object for non-object input instead of throwing", () => {
    expect(filterValidWindows(null)).toEqual({});
    expect(filterValidWindows("garbage")).toEqual({});
    expect(filterValidWindows(42)).toEqual({});
  });

  it("returns an empty object when every entry is malformed", () => {
    expect(filterValidWindows({ a: {}, b: { x: 1 } })).toEqual({});
  });
});
