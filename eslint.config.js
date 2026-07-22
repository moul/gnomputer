import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/*.config.*", "**/.turbo/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
        fetch: "readonly",
        Response: "readonly",
        RequestInit: "readonly",
        WebSocket: "readonly",
        globalThis: "readonly",
        crypto: "readonly",
        indexedDB: "readonly",
        TextEncoder: "readonly",
        TextDecoder: "readonly",
        URL: "readonly",
        KeyboardEvent: "readonly",
        process: "readonly",
      },
    },
  },
  {
    files: ["apps/web/src/**/*.{ts,tsx}", "packages/apps/*/src/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@gnomputer/rpc",
                "@gnomputer/rpc/*",
                "@gnomputer/storage",
                "@gnomputer/storage/*",
              ],
              message:
                "Apps must not import adapter packages directly — use @gnomputer/app-sdk.",
            },
          ],
        },
      ],
    },
  }
);
