import { describe, expect, it } from "vitest";
import { DEDICATED_APPS } from "./dedicated-apps";
import { APP_REGISTRY } from "./app-registry";

// Every field here is load-bearing and none of it is type-checked beyond
// "string": an id collision silently steals another app's window, and a
// mistyped pkgPath makes the entry vanish rather than fail, because a realm
// that does not resolve is indistinguishable from one that is not deployed
// on this chain (use-available-dedicated-apps.ts). Both failures are silent,
// which is exactly the kind worth a cheap test.
describe("DEDICATED_APPS", () => {
  it("gives every app a unique id, since the id is its window id", () => {
    const ids = DEDICATED_APPS.map((app) => app.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("points every app at a realm path, not a user-facing URL", () => {
    for (const app of DEDICATED_APPS) {
      expect(app.pkgPath, app.id).toMatch(/^gno\.land\/r\/[^/]+\/.+$/);
    }
  });

  it("embeds every app over https, since the shell itself is served over it", () => {
    for (const app of DEDICATED_APPS) {
      expect(app.url, app.id).toMatch(/^https:\/\//);
    }
  });

  it("gives every app a label and an icon to render in the island menu", () => {
    for (const app of DEDICATED_APPS) {
      expect(app.label.trim(), app.id).not.toBe("");
      expect(app.icon.trim(), app.id).not.toBe("");
    }
  });

  // An `external` app has no window, because its site refuses to be framed.
  // The registry is what the command palette reads, so an entry there for an
  // app with no window is an offer to focus something that was never mounted.
  it("registers a window for embeddable apps and none for external ones", () => {
    const registered = new Set(APP_REGISTRY.map((a) => a.id));
    for (const app of DEDICATED_APPS) {
      expect(registered.has(app.id), `${app.id} (external: ${!!app.external})`).toBe(
        !app.external
      );
    }
  });
});
