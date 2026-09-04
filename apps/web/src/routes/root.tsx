import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  useSearch,
} from "@tanstack/react-router";
import { Home } from "./home";
import { IslandBar } from "../shell/island-bar";
import { CommandPalette } from "../shell/command-palette";
import { ShortcutsHelp } from "../shell/shortcuts-help";
import { AppSwitcherOverlay } from "../shell/app-switcher-overlay";
import { UpdateBanner } from "../shell/update-banner";
import { AppErrorFallback } from "../shell/app-error-fallback";
import { ErrorBoundary } from "../shell/error-boundary";
import { useThemePersistence } from "../shell/use-theme-persistence";
import { useQueryCachePersistence } from "../shell/use-query-cache-persistence";
import { useSettingsTabPersistence } from "../shell/use-settings-tab-persistence";
import { useRealmTabsPersistence } from "../shell/use-realm-tabs-persistence";
import { useRetireOrphanedState } from "../shell/use-retire-orphaned-state";
import { useZoomPersistence } from "../shell/use-zoom-persistence";
import { useBrowserHomePersistence } from "../shell/use-browser-home-persistence";
import { useNetworkPersistence } from "../shell/use-network-persistence";
import { useLiveUpdatesPersistence } from "../shell/use-live-updates-persistence";
import { NetworkRecoveryBanner } from "../shell/network-recovery-banner";
import { isRealmLens, type RealmLens } from "../shell/realm-tabs-store";
import { useGlobalShortcuts } from "../shell/use-global-shortcuts";
import { useWalletInit } from "../shell/use-wallet-init";

function RootLayout() {
  useThemePersistence();
  useQueryCachePersistence();
  useSettingsTabPersistence();
  useRealmTabsPersistence();
  useRetireOrphanedState();
  useZoomPersistence();
  useLiveUpdatesPersistence();
  useBrowserHomePersistence();
  // Owns the custom-network list hydration too — the active network can
  // only be resolved once that list is known.
  const { unresolvedNetworkId } = useNetworkPersistence(useSearch({ strict: false }).net);
  useGlobalShortcuts();
  useWalletInit();
  return (
    <>
      <ErrorBoundary>
        <IslandBar />
      </ErrorBoundary>
      <ErrorBoundary>
        <CommandPalette />
      </ErrorBoundary>
      <ErrorBoundary>
        <ShortcutsHelp />
      </ErrorBoundary>
      <ErrorBoundary>
        <AppSwitcherOverlay />
      </ErrorBoundary>
      <ErrorBoundary>
        <UpdateBanner />
      </ErrorBoundary>
      <ErrorBoundary>
        <NetworkRecoveryBanner unresolvedNetworkId={unresolvedNetworkId} />
      </ErrorBoundary>
      <main>
        {/* The page had no <h1> at all, so screen-reader heading navigation
            started at some window's h2 with nothing naming the page itself.
            Visually hidden because the desktop's identity is carried by the
            island bar, not by a banner. */}
        <h1 className="visually-hidden">Gnomputer — a desktop for gno.land</h1>
        <Outlet />
      </main>
    </>
  );
}

const rootRoute = createRootRoute({ component: RootLayout });
const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Home,
  // Everything here has to survive being pasted into a chat window and
  // opened by someone else. Only pkg and path did, so a link to a realm's
  // SOURCE opened on Render, and a link to a betanet realm opened on Topaz
  // showing the wrong chain's data under the right-looking URL (AUD-012).
  validateSearch: (
    search: Record<string, unknown>
  ): { pkg?: string; path?: string; lens?: RealmLens; net?: string } => ({
    pkg: typeof search.pkg === "string" ? search.pkg : undefined,
    path: typeof search.path === "string" ? search.path : undefined,
    // Validated against the known set rather than passed through: an
    // unknown lens would leave the browser rendering nothing at all.
    lens: isRealmLens(search.lens) ? search.lens : undefined,
    net: typeof search.net === "string" ? search.net : undefined,
  }),
});

const routeTree = rootRoute.addChildren([homeRoute]);

// Every search value we use (pkg, path) is a plain string, but the
// router's default stringifySearch JSON-encodes every value regardless of
// type — a package path ends up as ?pkg=%22gno.land%2Fr%2Fgov%2Fdao%22, with
// literal quote characters in the URL. Gnomputer's URIs are meant to be
// shareable (spec §8.1), so encode strings as plain query values and only
// fall back to JSON for anything non-string.
function stringifySearch(search: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (value === undefined) continue;
    params.set(key, typeof value === "string" ? value : JSON.stringify(value));
  }
  const str = params.toString();
  return str ? `?${str}` : "";
}

function parseSearch(searchStr: string): Record<string, unknown> {
  const params = new URLSearchParams(searchStr);
  const result: Record<string, unknown> = {};
  for (const [key, value] of params.entries()) {
    result[key] = value;
  }
  return result;
}

export const router = createRouter({
  routeTree,
  basepath: import.meta.env.BASE_URL,
  stringifySearch,
  parseSearch,
  // Applies to every route's own error boundary (not just the root
  // layout's) — a render error thrown by Home or any window content it
  // mounts is caught here too, which is where an incompatible-persisted-
  // state crash actually happens.
  defaultErrorComponent: AppErrorFallback,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export function AppRouter() {
  return <RouterProvider router={router} />;
}
