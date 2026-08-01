import { defineConfig } from "@playwright/test";

// A fixed port so VITE_RPC_URL below can be static. 26658 is one past
// Tendermint's conventional 26657, to avoid colliding with a real local node.
const MOCK_RPC_PORT = 26658;
const MOCK_RPC_URL = `http://127.0.0.1:${MOCK_RPC_PORT}`;

// The suite runs against apps/mock-server, not the live chain. Running it
// against real Topaz made CI fail on unrelated PRs whenever the chain was
// slow or a fixture realm changed shape (AUD-050) — and the mock server
// already existed, fixtures and all, with nothing consuming it.
//
// Specs that genuinely need the real chain should be tagged @live and are
// excluded here; run them deliberately with `--grep @live`.
export default defineConfig({
  testDir: "./e2e",
  grepInvert: /@live/,
  webServer: [
    {
      command: "pnpm --filter @gnomputer/mock-server start",
      port: MOCK_RPC_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: "pnpm dev --port 5183",
      port: 5183,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: { VITE_RPC_URL: MOCK_RPC_URL },
    },
  ],
  use: {
    baseURL: "http://localhost:5183",
    // The app honours prefers-reduced-motion by disabling every transition
    // and animation. Turning it on here removes a whole class of "element
    // is not stable" flakes, where Playwright refuses to click a control
    // that is still sliding into place as its window opens.
    reducedMotion: "reduce",
  },
  timeout: 30_000,
});
