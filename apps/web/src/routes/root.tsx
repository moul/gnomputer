import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { Home } from "./home";
import { IslandBar } from "../shell/island-bar";
import { CommandPalette } from "../shell/command-palette";
import { useThemePersistence } from "../shell/use-theme-persistence";
import { useQueryCachePersistence } from "../shell/use-query-cache-persistence";
import { useSettingsTabPersistence } from "../shell/use-settings-tab-persistence";
import { useRealmTabsPersistence } from "../shell/use-realm-tabs-persistence";
import { useZoomPersistence } from "../shell/use-zoom-persistence";

function RootLayout() {
  useThemePersistence();
  useQueryCachePersistence();
  useSettingsTabPersistence();
  useRealmTabsPersistence();
  useZoomPersistence();
  return (
    <>
      <IslandBar />
      <CommandPalette />
      <main>
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
  validateSearch: (search: Record<string, unknown>): { pkg?: string; path?: string } => ({
    pkg: typeof search.pkg === "string" ? search.pkg : undefined,
    path: typeof search.path === "string" ? search.path : undefined,
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
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export function AppRouter() {
  return <RouterProvider router={router} />;
}
