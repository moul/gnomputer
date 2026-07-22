import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  webServer: {
    command: "pnpm dev --port 5183",
    port: 5183,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  use: { baseURL: "http://localhost:5183" },
  timeout: 30_000,
});
