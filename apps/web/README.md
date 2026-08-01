# @gnomputer/web

The PWA. This is the only thing that ships.

```bash
pnpm dev            # http://localhost:5173
pnpm test           # vitest
pnpm e2e            # playwright, against apps/mock-server
pnpm build
```

React 18 + Vite, TanStack Router and Query, zustand for shell state,
CodeMirror 6 for editing. All chain data arrives through
`@gnomputer/app-sdk` — importing `@gnomputer/rpc` or `@gnomputer/storage`
here is an eslint error.

## Layout

```
src/routes/    one file per app/window body, plus the router and the desktop
src/shell/     the desktop itself: window manager, island bar, command
               palette, settings, zustand stores, persistence, wallet glue
src/styles/    theme.css (tokens, one block per theme) and shell.css
src/*.ts       cross-cutting hooks and pure helpers
```

## Adding an app

Two lists, and nothing keeps them in sync for you:

1. **`src/shell/app-registry.ts`** — `APP_REGISTRY` gives the app its id,
   label, icon, and whether it supports multiple windows. This drives the
   island bar and window icons. `hiddenFromIsland` apps are reachable only
   contextually. Note the command palette does *not* read this registry.
2. **`src/routes/home.tsx`** — mounts the actual `<Window>`. Every app except
   `RealmBrowser` is `React.lazy()`-imported, deliberately: RealmBrowser is
   open on first load, so lazy-loading it would only add a round trip.

`<Window>` self-registers into `window-store` via `ensureWindow(...)`, which
no-ops for an id that already exists — including one restored from a saved
layout. That's what stops a re-render from resetting a window the user has
dragged.

**If you change the set of default window ids, bump the version suffix in
`useWindowPersistence("window-layout:home:v9")`.** A restored older layout
has no entry for the new window, so it stays hidden and looks like your app
doesn't work.

## Things that will surprise you

**`src/polyfills.ts` must be imported first.** It installs the `Buffer`
global, and anything importing `@gnolang/tm2-js-client` before it throws on
every account or balance decode.

**The service worker is `registerType: "prompt"` and deliberately not
`skipWaiting`/`clientsClaim`.** Setting those broke the update banner: the
Refresh button reloaded into the *old* build, leaving the banner stuck
forever. Workbox's `globPatterns` is a deliberate shell-only allowlist rather
than "everything" — precaching every chunk pulled ~1.8MB on first visit.
`version.json` is `globIgnores`d so the version check always hits the
network.

**Coverage thresholds are a ratchet just under what `main` measures**, not a
target. Measure a new baseline on `main`; lazy imports leave modules in the
denominator without contributing covered lines, so a branch that adds one
reads artificially low.

**`root.tsx` has custom `stringifySearch`/`parseSearch`** so that
`?pkg=gno.land/r/...` isn't JSON-quoted, keeping URLs shareable.

**The build shells out to git** for `__GIT_HASH__`, falling back to
`"unknown"`. `base` honours `VITE_BASE_PATH`, and `postbuild` copies
`dist/index.html` to `dist/404.html` for SPA fallback on static hosts.

## Tests

Unit tests sit next to what they test, under jsdom (configured in
`vite.config.ts`, there is no separate vitest config). Playwright specs live
in `e2e/` and run against `apps/mock-server`; anything needing the real chain
is tagged `@live` and excluded from the default run.

Two gates are easy to trip without realising they exist:
`src/styles/contrast.test.ts` requires every theme token to clear WCAG AA,
and `e2e/accessibility.spec.ts` runs axe over every theme and every app.
