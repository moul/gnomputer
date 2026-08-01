import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "src/shell/embed-frame.tsx"), "utf8");

describe("embedded iframes", () => {
  it("are sandboxed without allow-top-navigation", () => {
    // Without the sandbox, an embedded page can navigate the whole
    // Gnomputer tab elsewhere — which a visitor experiences as Gnomputer
    // itself redirecting them (AUD-033). Everything the embedded tools
    // actually need is granted; top navigation is the one thing withheld.
    const match = source.match(/sandbox="([^"]+)"/);
    expect(match, "the embed iframe has no sandbox attribute").not.toBeNull();

    const granted = match![1]!.split(/\s+/);
    expect(granted).toContain("allow-scripts");
    expect(granted).toContain("allow-same-origin");
    expect(granted).not.toContain("allow-top-navigation");
    expect(granted).not.toContain("allow-top-navigation-by-user-activation");
  });
});
