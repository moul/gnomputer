export interface DedicatedApp {
  id: string;
  label: string;
  icon: string;
  /** Full gno package path, checked against the active network to decide
   * whether this app's menu entry and window should exist at all — a realm
   * deployed on one chain is not deployed on every chain. */
  pkgPath: string;
  /** The app's own external site, embedded in its dedicated window. */
  url: string;
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
];
