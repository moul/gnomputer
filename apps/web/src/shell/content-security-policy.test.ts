import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const html = readFileSync(resolve(process.cwd(), "index.html"), "utf8");

function policy(): Record<string, string> {
  const match = html.match(
    /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/
  );
  expect(match, "no Content-Security-Policy meta tag in index.html").not.toBeNull();
  return Object.fromEntries(
    match![1]!
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [name, ...values] = part.split(/\s+/);
        return [name!, values.join(" ")];
      })
  );
}

describe("Content-Security-Policy", () => {
  it("blocks injected script, which is the directive that carries this policy", () => {
    // GitHub Pages cannot set response headers, so this is a meta tag with
    // meta-tag limits. script-src is the part that genuinely pays: the app
    // has no inline script at all, so 'self' costs nothing and removes the
    // main XSS payload path.
    expect(policy()["script-src"]).toBe("'self'");
  });

  it("blocks plugins and base-tag injection", () => {
    expect(policy()["object-src"]).toBe("'none'");
    expect(policy()["base-uri"]).toBe("'self'");
  });

  it("leaves connect-src open, deliberately", () => {
    // Custom networks let you point the app at any RPC endpoint you run,
    // including a local one over http. An allowlist here would either break
    // that feature or become a list of every host anyone might use, which
    // is not a control. This test exists so the choice stays deliberate
    // rather than being tightened into a bug report.
    expect(policy()["connect-src"]).toBe("*");
  });

  it("does not rely on frame-ancestors, which meta CSP ignores", () => {
    // If this ever appears here it would look like clickjacking protection
    // while doing nothing. That needs a real response header.
    expect(policy()["frame-ancestors"]).toBeUndefined();
  });
});
