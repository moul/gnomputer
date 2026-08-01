import { execSync } from "node:child_process";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

function gitHash(): string {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "unknown";
  }
}

// Computed once so the JS bundle's __GIT_HASH__/__BUILD_TIME__ (below) and
// the version.json file emitted by writeVersionJson() below always agree —
// two separate `new Date()` calls could otherwise disagree by a few ms.
const buildTime = new Date().toISOString();
const buildHash = gitHash();

// Emits a small version.json alongside the built assets so a running tab can
// poll it (use-version-check.ts) and detect that a newer build has since
// been deployed — deliberately NOT reusing the service worker's own update
// lifecycle, since that only ever tells a tab a new SW *installed*, not
// whether the code already running in memory is stale.
function writeVersionJson(): Plugin {
  return {
    name: "write-version-json",
    apply: "build",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify({ hash: buildHash, buildTime }),
      });
    },
  };
}

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? "/",
  define: {
    // Surfaced in the Settings window and logged on boot so a stale-cache
    // report ("I reloaded and nothing changed") can be confirmed or ruled
    // out by comparing this against the latest commit, instead of guessing.
    __BUILD_TIME__: JSON.stringify(buildTime),
    __GIT_HASH__: JSON.stringify(buildHash),
    __GIT_REPO__: JSON.stringify("https://github.com/moul/gnomputer"),
  },
  build: {
    // The bundle sits around 1MB largely because of @gnolang/tm2-rpc and
    // @gnolang/tm2-js-client's own dependency chain (@cosmjs/*, protobufjs,
    // @bufbuild/protobuf) — the price of using the maintained Gno/Tendermint2
    // clients instead of hand-rolling wire-protocol encoding. That chain is
    // its own manual chunk (below), separate from both "vendor" (react et
    // al.) and the app-code chunk — none of the three change together, so a
    // future app-code-only deploy invalidates only the smallest of the
    // three for a returning visitor instead of one ~1MB blob.
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (/[\\/]node_modules[\\/](@gnolang|@cosmjs|protobufjs|@bufbuild)[\\/]/.test(id)) {
            return "chain-client";
          }
          if (/[\\/]node_modules[\\/](react|react-dom|@tanstack|zustand)[\\/]/.test(id)) {
            return "vendor";
          }
          return undefined;
        },
      },
    },
  },
  plugins: [
    react(),
    writeVersionJson(),
    VitePWA({
      // "prompt" (not "autoUpdate") because we ARE prompting — the update
      // banner's Refresh button calls updateServiceWorker() (use-sw-update.ts,
      // via virtual:pwa-register/react) rather than silently swapping the
      // active version out from under a tab with unsaved state. injectRegister
      // is off because that hook does its own navigator.serviceWorker.register()
      // call — the auto-injected registerSW.js script (the default) would
      // otherwise register a second, uncoordinated time.
      registerType: "prompt",
      injectRegister: false,
      workbox: {
        // NOT skipWaiting/clientsClaim. Those were set to avoid the classic
        // "I reloaded and it's still the old version" bug, but combined with
        // registerType: "prompt" they caused it instead: a new worker that
        // never *waits* never sets the `needRefresh` flag the update banner
        // keys off, so the banner's Refresh button fell through to a plain
        // reload — which the OLD worker still served from its own precache.
        // Reproduced end to end (see update-banner.tsx): the tab stayed on
        // the old build and the banner reappeared, forever.
        //
        // Letting the new worker wait is what makes the prompt flow work:
        // `needRefresh` becomes true, and the banner's Refresh posts
        // SKIP_WAITING and reloads only after controllerchange.
        // version.json must always hit the network (use-version-check.ts
        // already fetches it with cache: "no-store" and a cache-busting
        // query param) — precaching it here would let the service worker
        // serve a stale copy from the very build being checked against.
        globIgnores: ["version.json"],
        // Precache the SHELL only. The default pattern swept in all 27 built
        // files (~1.86MB), including the 449KB code editor, the markdown
        // renderer, and every per-app chunk — so a first visit downloaded
        // every app up front, exactly undoing the lazy-loading those chunks
        // exist for. This is an explicit allow-list rather than a list of
        // exclusions so a newly-added lazy chunk is runtime-cached by
        // default instead of silently rejoining the precache (AUD-038).
        // The manifest, favicon and icons are injected by vite-plugin-pwa
        // itself — listing them here too produced duplicate precache
        // entries (16 entries for 11 unique URLs).
        globPatterns: [
          "index.html",
          "assets/index-*.js",
          "assets/vendor-*.js",
          "assets/chain-client-*.js",
          "assets/*.css",
        ],
        runtimeCaching: [
          {
            // Everything not precached — the lazy app chunks — is cached the
            // first time it's actually needed. Content-hashed filenames mean
            // a cached entry can never be stale: a new build produces a new
            // URL. CacheFirst is therefore safe and avoids a revalidation
            // round trip on every window open.
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.includes("/assets/"),
            handler: "CacheFirst",
            options: {
              cacheName: "app-chunks",
              expiration: { maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: "Gnomputer",
        short_name: "Gnomputer",
        description: "Boot the shared computer.",
        theme_color: "#0b0f14",
        background_color: "#0b0f14",
        display: "standalone",
        // iOS ignores SVG icons entirely, and Android needs a dedicated
        // "maskable" asset — with only the SVG here, an installed app got a
        // blurry screenshot icon on iOS and a letterboxed one on Android.
        // The maskable variant keeps the logo inside the ~80% safe zone
        // with the background bled to the edges, so platform cropping to a
        // circle/squircle can't clip it.
        icons: [
          { src: "favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  test: {
    environment: "jsdom",
    exclude: ["**/node_modules/**", "e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}"],
      // Excluded from the DENOMINATOR, not from testing: type-only files
      // and entry points have nothing meaningfully coverable, and counting
      // them just makes the number dishonest.
      exclude: ["src/**/*.d.ts", "src/main.tsx", "src/**/*.test.{ts,tsx}"],
      // A ratchet, not a target. These are set just under today's real
      // numbers so the gate catches a regression immediately; raise them as
      // coverage improves rather than picking an aspirational figure that
      // has to be ignored.
      // Measured on main: statements/lines 23.5%, functions 34.6%,
      // branches 87.5%. Set just under each so a regression fails the build
      // immediately; raise them as coverage improves.
      //
      // The first version of these numbers was taken on a branch that
      // predated lazy-loading the route components (#105). Lazy imports mean
      // those modules aren't pulled in during unit tests, so they count in
      // the denominator without contributing covered lines — real coverage
      // is ~2 points lower than it looked. Measure the baseline on main, not
      // on a feature branch.
      thresholds: { lines: 23, statements: 23, functions: 33, branches: 85 },
    },
  },
});
