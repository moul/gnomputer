export interface DedicatedApp {
  id: string;
  label: string;
  icon: string;
  /** Full gno package path, checked against the active network to decide
   * whether this app's menu entry and window should exist at all — a realm
   * deployed on one chain is not deployed on every chain. */
  pkgPath: string;
  /** The app's own external site, embedded in its dedicated window unless
   * `external` says it cannot be. */
  url: string;
  /** Set when the site refuses to be framed, so it opens in a new tab rather
   * than a dedicated window.
   *
   * An `X-Frame-Options` or a `frame-ancestors` that excludes us is not
   * something the embed can recover from or even detect: the browser blocks
   * the load and the iframe stays cross-origin opaque, so the window renders
   * blank and looks like the app is broken rather than like it declined.
   * Better to send people to the real site than to show them an empty pane.
   *
   * Check before adding an app, because it is invisible from the markup:
   *   curl -sI <url> | grep -iE 'x-frame-options|content-security-policy' */
  external?: boolean;
}

// Apps with real deployments elsewhere that are worth a dedicated shortcut
// from inside Gnomputer, rather than just being another realm someone
// navigates to by path. Each one only shows up when its pkgPath actually
// resolves on the active network (use-available-dedicated-apps.ts) — a
// realm confirmed live on Mainnet is not necessarily on Pearl or Staging.
export const DEDICATED_APPS: DedicatedApp[] = [
  {
    id: "kourt",
    label: "Kourt",
    // Scales of justice — Kourt is a dispute-resolution/court realm.
    icon: "⚖️",
    pkgPath: "gno.land/r/g1ecsuj0q572jr0dhu29q9njtnmw03hyu7tyyvv6/kourt",
    url: "https://kourt.xyz",
  },
  {
    id: "bubblerumble",
    label: "Bubble Rumble",
    // A bubble, for the pot game the site is named after.
    icon: "🫧",
    // Five game realms are live from this deployer, `bubblerumble` through
    // `bubblerumble5`, and the site plays the newest one. This probes the
    // first rather than the current one on purpose: a deployed realm is
    // permanent, so v1 is the stable answer to "is this app on this chain"
    // and does not need editing every time a new version ships. Confirmed
    // live on Mainnet and absent on Pearl (InvalidPackageError), so the
    // entry correctly hides itself off Mainnet.
    pkgPath: "gno.land/r/g1leu8d2vsplhehcfkjg50mwgdpxdkt8tztu95wr/bubblerumble",
    url: "https://bubblerumble.net",
    // Sends `X-Frame-Options: sameorigin`, confirmed in a real browser: the
    // frame is refused outright, so an embedded window would be blank. Kourt
    // above sets `frame-ancestors *` and embeds fine, which is the whole
    // difference between the two entries.
    external: true,
  },
];
