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
