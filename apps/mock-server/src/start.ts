import { createMockServer } from "./index.js";

// Standalone entry so Playwright's `webServer` can boot the mock RPC as a
// real process (the library export is used by unit tests in-process).
// A fixed port keeps playwright.config.ts's VITE_RPC_URL static.
const PORT = Number(process.env.MOCK_RPC_PORT ?? 26658);

void createMockServer(PORT).then((handle) => {
  // Playwright waits on this URL, so it must be logged only once listening.
  console.log(`mock RPC listening on ${handle.url}`);
  const shutdown = () => void handle.close().then(() => process.exit(0));
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
});
