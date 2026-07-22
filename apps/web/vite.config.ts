import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? "/",
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
