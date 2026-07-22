import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { Home } from "./home";
import { WorldExplorer } from "./world-explorer";
import { AccountPage } from "./account-page";
import { TopBar } from "../shell/top-bar";
import { CommandPalette } from "../shell/command-palette";

function RootLayout() {
  return (
    <>
      <TopBar />
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
const worldRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/world",
  component: WorldExplorer,
});
const accountRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/account",
  component: AccountPage,
  validateSearch: (search: Record<string, unknown>): { addr?: string } => ({
    addr: typeof search.addr === "string" ? search.addr : undefined,
  }),
});

const routeTree = rootRoute.addChildren([homeRoute, worldRoute, accountRoute]);

// Every search value we use (pkg, path, addr) is a plain string, but the
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
