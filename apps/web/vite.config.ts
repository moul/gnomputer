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
    // clients instead of hand-rolling wire-protocol encoding. Splitting
    // vendor code into its own chunk doesn't shrink that, but it means a
    // future app-code-only change doesn't invalidate the cached vendor chunk
    // for returning visitors.
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: [
            "react",
            "react-dom",
            "@tanstack/react-router",
            "@tanstack/react-query",
            "zustand",
          ],
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
        // Without these, an updated service worker installs but stays
        // "waiting" until every open tab is fully closed — the classic PWA
        // "I reloaded and it's still the old version" bug. skipWaiting lets
        // the new SW activate immediately; clientsClaim lets it take control
        // of already-open pages instead of only new navigations.
        skipWaiting: true,
        clientsClaim: true,
        // version.json must always hit the network (use-version-check.ts
        // already fetches it with cache: "no-store" and a cache-busting
        // query param) — precaching it here would let the service worker
        // serve a stale copy from the very build being checked against.
        globIgnores: ["version.json"],
      },
      manifest: {
        name: "Gnomputer",
        short_name: "Gnomputer",
        description: "Boot the shared computer.",
        theme_color: "#0b0f14",
        background_color: "#0b0f14",
        display: "standalone",
        icons: [
          {
            src: "favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
      },
    }),
  ],
  test: {
    environment: "jsdom",
    exclude: ["**/node_modules/**", "e2e/**"],
  },
});
