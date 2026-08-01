/// <reference types="vite-plugin-pwa/client" />

declare const __BUILD_TIME__: string;
declare const __GIT_HASH__: string;
declare const __GIT_REPO__: string;

// Set only by the e2e harness (playwright.config.ts) to point the app at a
// local mock RPC instead of the live chain — see test-network-override.ts.
interface ImportMetaEnv {
  readonly VITE_RPC_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
