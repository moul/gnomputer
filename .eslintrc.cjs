module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  env: { es2022: true, node: true, browser: true },
  ignorePatterns: ["dist", "node_modules", "*.config.*"],
  overrides: [
    {
      files: ["apps/web/src/**/*.{ts,tsx}", "packages/apps/*/src/**/*.{ts,tsx}"],
      excludedFiles: ["**/*.test.{ts,tsx}"],
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
    },
  ],
};
