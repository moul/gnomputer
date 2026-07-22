import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { Home } from "./home";
import { WorldExplorer } from "./world-explorer";

const rootRoute = createRootRoute({ component: () => <Outlet /> });
const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Home,
  validateSearch: (search: Record<string, unknown>): { pkg?: string } => ({
    pkg: typeof search.pkg === "string" ? search.pkg : undefined,
  }),
});
const worldRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/world",
  component: WorldExplorer,
});

const routeTree = rootRoute.addChildren([homeRoute, worldRoute]);
export const router = createRouter({ routeTree, basepath: import.meta.env.BASE_URL });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export function AppRouter() {
  return <RouterProvider router={router} />;
}
