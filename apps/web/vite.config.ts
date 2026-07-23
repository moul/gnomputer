import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? "/",
  define: {
    // Surfaced in the Settings window and logged on boot so a stale-cache
    // report ("I reloaded and nothing changed") can be confirmed or ruled
    // out by comparing this against the latest commit, instead of guessing.
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  build: {
    // The bundle sits around 1MB largely because of @gnolang/tm2-rpc and
    // @gnolang/tm2-js-client's own dependency chain (@cosmjs/*, protobufjs,
    // @bufbuild/protobuf) — the price of using the maintained Gno/Tendermint2
    // clients instead of hand-rolling wire-protocol encoding. Splitting
    // vendor code into its own chunk doesn't shrink that, but it means a
    // future app-code-only change doesn't invalidate the cached vendor chunk
    // for returning visitors. Route-level code splitting (lazy-loading
    // World/Account) is the next real lever if bundle size becomes a problem
    // — not done here since Home needs the same RPC clients immediately
    // anyway, so it wouldn't reduce first-paint cost.
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
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        // Without these, an updated service worker installs but stays
        // "waiting" until every open tab is fully closed — the classic PWA
        // "I reloaded and it's still the old version" bug. skipWaiting lets
        // the new SW activate immediately; clientsClaim lets it take control
        // of already-open pages instead of only new navigations.
        skipWaiting: true,
        clientsClaim: true,
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
