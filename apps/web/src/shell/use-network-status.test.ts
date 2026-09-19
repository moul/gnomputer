import { describe, expect, it } from "vitest";
import { findChainIdMismatch } from "./use-network-status";

describe("findChainIdMismatch", () => {
  // The case this exists for: mainnet was configured as "gnoland1" against a
  // chain calling itself "gnoland-1". Nothing compared the two, so the only
  // symptom was assertChainMatch refusing every signature and blaming the
  // wallet for it.
  const cases: Array<{
    name: string;
    configured: string | undefined;
    reported: string | undefined;
    expected: { configured: string; reported: string } | undefined;
  }> = [
    {
      name: "reports the hyphen typo that shipped on mainnet",
      configured: "gnoland1",
      reported: "gnoland-1",
      expected: { configured: "gnoland1", reported: "gnoland-1" },
    },
    {
      name: "says nothing when the two agree",
      configured: "gnoland-1",
      reported: "gnoland-1",
      expected: undefined,
    },
    {
      name: "says nothing before the first status response lands",
      configured: "gnoland-1",
      reported: undefined,
      expected: undefined,
    },
    {
      // "unknown" is the absence of a claim, not a conflicting one, and
      // assertChainMatch already refuses to sign on it.
      name: "does not call an undiscoverable custom network a mismatch",
      configured: "unknown",
      reported: "pearl-1",
      expected: undefined,
    },
    {
      name: "says nothing when the network has no chain id at all",
      configured: undefined,
      reported: "pearl-1",
      expected: undefined,
    },
    {
      // Chain ids are compared exactly, the same way assertChainMatch does,
      // so a case difference is a real mismatch rather than a near miss.
      name: "treats a case difference as a mismatch, matching assertChainMatch",
      configured: "Pearl-1",
      reported: "pearl-1",
      expected: { configured: "Pearl-1", reported: "pearl-1" },
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      expect(findChainIdMismatch(c.configured, c.reported)).toEqual(c.expected);
    });
  }
});
