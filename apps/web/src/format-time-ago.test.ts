import { describe, it, expect } from "vitest";
import { formatTimeAgo } from "./format-time-ago";

const NOW = new Date("2026-07-26T12:00:00.000Z").getTime();

function isoSecondsAgo(seconds: number): string {
  return new Date(NOW - seconds * 1000).toISOString();
}

describe("formatTimeAgo", () => {
  it("formats under a minute as seconds", () => {
    expect(formatTimeAgo(isoSecondsAgo(0), NOW)).toBe("0s ago");
    expect(formatTimeAgo(isoSecondsAgo(45), NOW)).toBe("45s ago");
    expect(formatTimeAgo(isoSecondsAgo(59), NOW)).toBe("59s ago");
  });

  it("formats under an hour as minutes", () => {
    expect(formatTimeAgo(isoSecondsAgo(60), NOW)).toBe("1m ago");
    expect(formatTimeAgo(isoSecondsAgo(90), NOW)).toBe("2m ago");
    expect(formatTimeAgo(isoSecondsAgo(59 * 60), NOW)).toBe("59m ago");
  });

  it("formats under a day as hours", () => {
    expect(formatTimeAgo(isoSecondsAgo(60 * 60), NOW)).toBe("1h ago");
    expect(formatTimeAgo(isoSecondsAgo(23 * 60 * 60), NOW)).toBe("23h ago");
  });

  it("formats a day or more as days", () => {
    expect(formatTimeAgo(isoSecondsAgo(24 * 60 * 60), NOW)).toBe("1d ago");
    expect(formatTimeAgo(isoSecondsAgo(9 * 24 * 60 * 60), NOW)).toBe("9d ago");
  });

  it("rounds a boundary that crosses a tier up into the next tier's unit", () => {
    // 3599s = 59m59s: seconds/60 rounds to 60, which fails the "< 60"
    // minutes check, so this must read in hours, not "60m ago".
    expect(formatTimeAgo(isoSecondsAgo(3599), NOW)).toBe("1h ago");
  });

  it("clamps a future/clock-skewed timestamp to 0s instead of going negative", () => {
    const future = new Date(NOW + 5000).toISOString();
    expect(formatTimeAgo(future, NOW)).toBe("0s ago");
  });

  it("defaults `now` to the real current time when omitted", () => {
    const result = formatTimeAgo(new Date().toISOString());
    expect(result).toBe("0s ago");
  });
});
