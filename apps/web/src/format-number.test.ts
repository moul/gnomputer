import { describe, it, expect } from "vitest";
import { formatNumber, formatGnotAmount, formatUgnotString } from "./format-number";

describe("formatNumber", () => {
  it("always uses comma thousands separators regardless of runtime locale", () => {
    expect(formatNumber(44043502946)).toBe("44,043,502,946");
  });

  it("passes through Intl.NumberFormatOptions", () => {
    expect(formatNumber(2420.284169, { maximumFractionDigits: 2 })).toBe("2,420.28");
  });
});

describe("formatGnotAmount", () => {
  it("converts ugnot to GNOT with a clean period decimal", () => {
    expect(formatGnotAmount(2420284169)).toBe("2,420.284169 GNOT");
  });

  it("formats a whole-number amount with no trailing decimal", () => {
    expect(formatGnotAmount(1_000_000)).toBe("1 GNOT");
  });
});

describe("formatUgnotString", () => {
  it("parses a real \"NNNugnot\" coin string", () => {
    expect(formatUgnotString("3618115104ugnot")).toBe("3,618.115104 GNOT");
  });

  it("falls back to \"0 GNOT\" for an empty string", () => {
    expect(formatUgnotString("")).toBe("0 GNOT");
  });

  it("returns non-matching input unchanged", () => {
    expect(formatUgnotString("not-a-coin")).toBe("not-a-coin");
  });
});
