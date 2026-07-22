# Slice 1 Boot Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first demoable vertical slice of Gnomputer: a guest-mode PWA that boots
into a live view of a realm, its source, and recent chain activity on the official Gno
testnet, with Trails auto-recording navigation and workspace state persisting across reloads.

**Architecture:** pnpm + Turborepo monorepo. Core data-model packages (`entities`, `core`,
`networks`, `rpc`, `lenses`, `storage`, `trails`) are composed into a single `app-sdk`
package that is the *only* import surface `apps/web` is allowed to use (enforced by
ESLint). `apps/web` is a Vite + React + TanStack Router SPA. `apps/mock-server` fakes the
Tendermint RPC surface from recorded fixtures for deterministic tests and offline dev.

**Tech Stack:** TypeScript (strict), React 18, Vite, TanStack Router, TanStack Query,
Zustand, Dexie, Zod, `@gnolang/tm2-js-client`, Vitest, Playwright, pnpm workspaces,
Turborepo, ESLint, GitHub Actions, GitHub Pages.

## Global Constraints

- TypeScript strict mode everywhere; no `any` without a `// justification:` comment.
- Apps never import adapter packages (`rpc`, `storage` internals) directly — only via `app-sdk` (spec §13).
- Every external/cached value is wrapped in a `DataEnvelope` before leaving an adapter (spec §10).
- No wallet, signing, Run Studio, Monaco, companion, filesystem access, Builder, Process Manager, plugins, or Tauri this slice (spec §41).
- Default network is the official Gno testnet: chain id `test-13`, RPC `https://rpc.test13.testnets.gno.land` (verified reachable, CORS-open, `vm/qfile`/`vm/qrender`/`vm/qeval` confirmed 2026-07-22).
- License: Apache-2.0. Package manager: pnpm (no corepack available on this machine — install pnpm directly).
- Deploy target: GitHub Pages via GitHub Actions on push to `main`; PRs run lint+typecheck+test+build.

---

## Task 1: Monorepo foundations

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.gitignore`, `.npmrc`, `.eslintrc.cjs`, `.prettierrc.json`, `LICENSE`

**Interfaces:**
- Produces: workspace glob `packages/*`, `packages/apps/*`, `apps/*`; shared `tsconfig.base.json` every package extends; root scripts `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm typecheck`.

- [ ] **Step 1: Root package.json**

```json
{
  "name": "gnomputer",
  "private": true,
  "license": "Apache-2.0",
  "engines": { "node": ">=20" },
  "packageManager": "pnpm@9.15.0",
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev --parallel",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "e2e": "turbo run e2e"
  },
  "devDependencies": {
    "turbo": "^2.3.0",
    "typescript": "^5.7.0",
    "eslint": "^9.17.0",
    "@typescript-eslint/eslint-plugin": "^8.18.0",
    "@typescript-eslint/parser": "^8.18.0",
    "prettier": "^3.4.2"
  }
}
```

- [ ] **Step 2: pnpm-workspace.yaml**

```yaml
packages:
  - "packages/*"
  - "packages/apps/*"
  - "apps/*"
```

- [ ] **Step 3: turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "dev": { "cache": false, "persistent": true },
    "test": { "dependsOn": ["^build"], "outputs": [] },
    "lint": { "outputs": [] },
    "typecheck": { "dependsOn": ["^build"], "outputs": [] },
    "e2e": { "dependsOn": ["build"], "outputs": [] }
  }
}
```

- [ ] **Step 4: tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "composite": true,
    "resolveJsonModule": true
  }
}
```

- [ ] **Step 5: .gitignore, .npmrc, LICENSE**

`.gitignore`:
```text
node_modules/
dist/
.turbo/
*.tsbuildinfo
.DS_Store
test-results/
playwright-report/
coverage/
```

`.npmrc`:
```text
auto-install-peers=true
strict-peer-dependencies=false
```

Fetch the Apache-2.0 license text into `LICENSE` (standard Apache-2.0, copyright line
`Copyright 2026 Gnomputer contributors`).

- [ ] **Step 6: Root ESLint config enforcing the SDK boundary**

`.eslintrc.cjs`:
```js
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  env: { es2022: true, node: true, browser: true },
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
                group: ["@gnomputer/rpc", "@gnomputer/rpc/*", "@gnomputer/storage", "@gnomputer/storage/*"],
                message: "Apps must not import adapter packages directly — use @gnomputer/app-sdk."
              }
            ]
          }
        ]
      }
    }
  ]
};
```

- [ ] **Step 7: Install pnpm and verify workspace**

Run: `npm i -g pnpm@9.15.0 && pnpm --version`
Expected: prints `9.15.0`

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-workspace.yaml turbo.json tsconfig.base.json .gitignore .npmrc .eslintrc.cjs .prettierrc.json LICENSE
git commit -m "chore: scaffold pnpm/turborepo monorepo foundations"
```

---

## Task 2: `packages/entities` — EntityRef and gno:// URIs

**Files:**
- Create: `packages/entities/package.json`, `packages/entities/tsconfig.json`, `packages/entities/src/index.ts`, `packages/entities/src/entity-ref.ts`, `packages/entities/src/uri.ts`, `packages/entities/src/entity-ref.test.ts`, `packages/entities/src/uri.test.ts`

**Interfaces:**
- Produces:
  - `type EntityKind = "network" | "realm" | "package" | "source-file" | "function" | "type" | "state-object" | "address" | "identity" | "account" | "balance" | "transaction" | "transaction-message" | "block" | "event" | "proposal" | "validator" | "local-workspace" | "local-file" | "process" | "trail"`
  - `interface EntityRef { uri: string; kind: EntityKind; networkId: string; chainId?: string; packagePath?: string; objectId?: string; filePath?: string; functionName?: string; height?: number | "latest"; lens?: LensId; query?: Record<string, string | number | boolean>; adapterVersion?: string }`
  - `const EntityRefSchema: z.ZodType<EntityRef>`
  - `function parseGnoUri(uri: string): EntityRef` (throws `InvalidUriError` on malformed input)
  - `function formatGnoUri(ref: Pick<EntityRef, "networkId" | "kind" | "packagePath" | "objectId" | "functionName">): string`

- [ ] **Step 1: Package scaffolding**

`packages/entities/package.json`:
```json
{
  "name": "@gnomputer/entities",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "lint": "eslint src",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": { "zod": "^3.24.1" },
  "devDependencies": { "vitest": "^2.1.8", "typescript": "^5.7.0" }
}
```

`packages/entities/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"]
}
```

- [ ] **Step 2: Write failing tests for URI parsing**

`packages/entities/src/uri.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseGnoUri, formatGnoUri } from "./uri";

describe("parseGnoUri", () => {
  it("parses a realm URI", () => {
    const ref = parseGnoUri("gno://test13/realm/gno.land/r/gov/dao");
    expect(ref).toMatchObject({
      kind: "realm",
      networkId: "test13",
      packagePath: "gno.land/r/gov/dao",
    });
  });

  it("parses a function URI with a fragment", () => {
    const ref = parseGnoUri("gno://test13/function/gno.land/r/gov/dao#Vote");
    expect(ref).toMatchObject({
      kind: "function",
      networkId: "test13",
      packagePath: "gno.land/r/gov/dao",
      functionName: "Vote",
    });
  });

  it("parses an address URI", () => {
    const ref = parseGnoUri("gno://test13/address/g1abc123");
    expect(ref).toMatchObject({
      kind: "address",
      networkId: "test13",
      objectId: "g1abc123",
    });
  });

  it("parses a transaction URI", () => {
    const ref = parseGnoUri("gno://test13/tx/ABC123");
    expect(ref).toMatchObject({
      kind: "transaction",
      networkId: "test13",
      objectId: "ABC123",
    });
  });

  it("throws on an unknown scheme", () => {
    expect(() => parseGnoUri("https://example.com")).toThrow(/scheme/i);
  });

  it("round-trips through formatGnoUri", () => {
    const uri = formatGnoUri({ networkId: "test13", kind: "realm", packagePath: "gno.land/r/gov/dao" });
    expect(uri).toBe("gno://test13/realm/gno.land/r/gov/dao");
    expect(parseGnoUri(uri).packagePath).toBe("gno.land/r/gov/dao");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter @gnomputer/entities test`
Expected: FAIL — `./uri` has no exported member `parseGnoUri`

- [ ] **Step 4: Implement uri.ts**

`packages/entities/src/uri.ts`:
```ts
import type { EntityKind } from "./entity-ref";
import type { EntityRef } from "./entity-ref";

export class InvalidUriError extends Error {
  constructor(uri: string, reason: string) {
    super(`Invalid gno:// URI "${uri}": ${reason}`);
    this.name = "InvalidUriError";
  }
}

const TX_LIKE_KINDS = new Set<EntityKind>(["tx" as EntityKind]); // placeholder unused, removed below

const PATH_KIND_MAP: Record<string, EntityKind> = {
  realm: "realm",
  package: "package",
  function: "function",
  address: "address",
  identity: "identity",
  account: "account",
  tx: "transaction",
  block: "block",
  proposal: "proposal",
  validator: "validator",
  workspace: "local-workspace",
  trail: "trail",
};

export function parseGnoUri(uri: string): EntityRef {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    throw new InvalidUriError(uri, "not a valid URL");
  }

  if (parsed.protocol !== "gno:") {
    throw new InvalidUriError(uri, `expected "gno://" scheme, got "${parsed.protocol}"`);
  }

  const networkId = parsed.host;
  if (!networkId) {
    throw new InvalidUriError(uri, "missing network segment");
  }

  const segments = parsed.pathname.replace(/^\/+/, "").split("/").filter(Boolean);
  const [kindSegment, ...rest] = segments;
  const kind = kindSegment ? PATH_KIND_MAP[kindSegment] : undefined;
  if (!kind) {
    throw new InvalidUriError(uri, `unknown or missing entity kind "${kindSegment ?? ""}"`);
  }

  const ref: EntityRef = { uri, kind, networkId };

  if (kind === "realm" || kind === "package" || kind === "function") {
    ref.packagePath = rest.join("/");
  } else if (kind === "address" || kind === "identity" || kind === "account" || kind === "transaction" || kind === "block" || kind === "local-workspace" || kind === "trail") {
    ref.objectId = rest.join("/");
  } else if (kind === "proposal") {
    ref.packagePath = rest.slice(0, -1).join("/");
    ref.objectId = rest[rest.length - 1];
  } else if (kind === "validator") {
    ref.objectId = rest.join("/");
  }

  if (parsed.hash) {
    ref.functionName = parsed.hash.slice(1);
  }

  return ref;
}

export function formatGnoUri(
  ref: Pick<EntityRef, "networkId" | "kind" | "packagePath" | "objectId" | "functionName">
): string {
  const kindSegment = Object.entries(PATH_KIND_MAP).find(([, v]) => v === ref.kind)?.[0];
  if (!kindSegment) {
    throw new InvalidUriError("(formatting)", `no URI segment registered for kind "${ref.kind}"`);
  }
  const pathPart = ref.packagePath ?? ref.objectId ?? "";
  const fragment = ref.functionName ? `#${ref.functionName}` : "";
  return `gno://${ref.networkId}/${kindSegment}/${pathPart}${fragment}`;
}
```

Remove the unused `TX_LIKE_KINDS` placeholder line before committing — it was scaffolding
noise, not real code.

- [ ] **Step 5: Write entity-ref.ts (types + Zod schema) and its test**

`packages/entities/src/entity-ref.ts`:
```ts
import { z } from "zod";

export const EntityKindSchema = z.enum([
  "network", "realm", "package", "source-file", "function", "type", "state-object",
  "address", "identity", "account", "balance", "transaction", "transaction-message",
  "block", "event", "proposal", "validator", "local-workspace", "local-file", "process", "trail",
]);
export type EntityKind = z.infer<typeof EntityKindSchema>;

export const LensIdSchema = z.enum([
  "experience", "source", "docs", "state", "history", "actions", "graph", "raw", "time",
]);
export type LensId = z.infer<typeof LensIdSchema>;

export const EntityRefSchema = z.object({
  uri: z.string(),
  kind: EntityKindSchema,
  networkId: z.string(),
  chainId: z.string().optional(),
  packagePath: z.string().optional(),
  objectId: z.string().optional(),
  filePath: z.string().optional(),
  functionName: z.string().optional(),
  height: z.union([z.number(), z.literal("latest")]).optional(),
  lens: LensIdSchema.optional(),
  query: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  adapterVersion: z.string().optional(),
});
export type EntityRef = z.infer<typeof EntityRefSchema>;
```

`packages/entities/src/entity-ref.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { EntityRefSchema } from "./entity-ref";

describe("EntityRefSchema", () => {
  it("accepts a minimal valid ref", () => {
    const result = EntityRefSchema.safeParse({
      uri: "gno://test13/realm/gno.land/r/demo/foo",
      kind: "realm",
      networkId: "test13",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown kind", () => {
    const result = EntityRefSchema.safeParse({
      uri: "gno://test13/bogus/x",
      kind: "bogus",
      networkId: "test13",
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 6: index.ts barrel export**

`packages/entities/src/index.ts`:
```ts
export * from "./entity-ref";
export * from "./uri";
```

- [ ] **Step 7: Run tests, verify they pass**

Run: `pnpm --filter @gnomputer/entities test`
Expected: all tests PASS (7 tests)

- [ ] **Step 8: Commit**

```bash
git add packages/entities
git commit -m "feat(entities): add EntityRef, LensId and gno:// URI parsing"
```

---

## Task 3: `packages/core` — DataEnvelope

**Files:**
- Create: `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/src/index.ts`, `packages/core/src/data-envelope.ts`, `packages/core/src/data-envelope.test.ts`

**Interfaces:**
- Consumes: `EntityRef` from `@gnomputer/entities`
- Produces:
  - `interface DataEnvelope<T> { ref: EntityRef; data: T; source: "rpc"|"indexer"|"gnoweb"|"wallet"|"companion"|"cache"|"derived"; consistency: "authoritative"|"indexed"|"derived"|"best-effort"; networkId: string; chainId?: string; height?: number; fetchedAt: string; freshness: "live"|"cached"|"stale"|"historical"; schema: string; warnings?: DataWarning[] }`
  - `interface DataWarning { code: string; message: string }`
  - `function wrapEnvelope<T>(input: Omit<DataEnvelope<T>, "fetchedAt"> & { fetchedAt?: string }): DataEnvelope<T>` — fills `fetchedAt` with the caller-supplied value or throws if omitted and no clock is injected (this package must not call `Date.now()` directly in library code paths that could run in tests deterministically — callers pass `fetchedAt`).

- [ ] **Step 1: Package scaffolding** (same shape as Task 2 Step 1, name `@gnomputer/core`, dependency on `@gnomputer/entities` via `"workspace:*"`)

```json
{
  "name": "@gnomputer/core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "lint": "eslint src",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": { "@gnomputer/entities": "workspace:*", "zod": "^3.24.1" },
  "devDependencies": { "vitest": "^2.1.8", "typescript": "^5.7.0" }
}
```

`packages/core/tsconfig.json`: identical shape to Task 2's, `references: [{ "path": "../entities" }]` added.

- [ ] **Step 2: Write failing test**

`packages/core/src/data-envelope.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { DataEnvelopeSchema, wrapEnvelope } from "./data-envelope";

const ref = { uri: "gno://test13/realm/gno.land/r/demo/foo", kind: "realm" as const, networkId: "test13" };

describe("wrapEnvelope", () => {
  it("builds a valid envelope", () => {
    const env = wrapEnvelope({
      ref,
      data: { hello: "world" },
      source: "rpc",
      consistency: "authoritative",
      networkId: "test13",
      freshness: "live",
      schema: "test.v1",
      fetchedAt: "2026-07-22T00:00:00.000Z",
    });
    expect(DataEnvelopeSchema.safeParse(env).success).toBe(true);
  });

  it("rejects an invalid source", () => {
    const result = DataEnvelopeSchema.safeParse({
      ref, data: {}, source: "made-up", consistency: "authoritative",
      networkId: "test13", freshness: "live", schema: "test.v1", fetchedAt: "2026-07-22T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `pnpm --filter @gnomputer/core test`
Expected: FAIL — module `./data-envelope` not found

- [ ] **Step 4: Implement data-envelope.ts**

```ts
import { z } from "zod";
import { EntityRefSchema } from "@gnomputer/entities";

export const DataWarningSchema = z.object({ code: z.string(), message: z.string() });
export type DataWarning = z.infer<typeof DataWarningSchema>;

export const DataEnvelopeSchema = z.object({
  ref: EntityRefSchema,
  data: z.unknown(),
  source: z.enum(["rpc", "indexer", "gnoweb", "wallet", "companion", "cache", "derived"]),
  consistency: z.enum(["authoritative", "indexed", "derived", "best-effort"]),
  networkId: z.string(),
  chainId: z.string().optional(),
  height: z.number().optional(),
  fetchedAt: z.string(),
  freshness: z.enum(["live", "cached", "stale", "historical"]),
  schema: z.string(),
  warnings: z.array(DataWarningSchema).optional(),
});
export type DataEnvelope<T> = Omit<z.infer<typeof DataEnvelopeSchema>, "data"> & { data: T };

export function wrapEnvelope<T>(input: DataEnvelope<T>): DataEnvelope<T> {
  const result = DataEnvelopeSchema.safeParse(input);
  if (!result.success) {
    throw new Error(`Invalid DataEnvelope: ${result.error.message}`);
  }
  return input;
}
```

- [ ] **Step 5: index.ts barrel + run tests**

`packages/core/src/index.ts`: `export * from "./data-envelope";`

Run: `pnpm --filter @gnomputer/core test`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add packages/core
git commit -m "feat(core): add DataEnvelope with provenance and freshness"
```

---

## Task 4: `packages/networks` — network registry

**Files:**
- Create: `packages/networks/package.json`, `packages/networks/tsconfig.json`, `packages/networks/src/index.ts`, `packages/networks/src/network-config.ts`, `packages/networks/src/default-networks.ts`, `packages/networks/src/default-networks.test.ts`

**Interfaces:**
- Produces:
  - `interface NetworkConfig { id: string; name: string; chainId: string; rpcUrl: string; websocketUrl?: string; gnowebUrl?: string; indexerGraphqlUrl?: string; environment: "mainnet"|"betanet"|"staging"|"testnet"|"local"|"custom"; persistence: "persistent"|"rolling"|"ephemeral"|"unknown"; trust: "official"|"community"|"local"|"custom"; capabilities: string[]; warnings?: { code: string; message: string }[] }`
  - `const DEFAULT_NETWORKS: NetworkConfig[]` — includes `test13` (default) and `betanet`.
  - `const DEFAULT_NETWORK_ID = "test13"`

- [ ] **Step 1: Package scaffolding** (pattern per Task 2, name `@gnomputer/networks`, deps: zod only)

- [ ] **Step 2: Write failing test**

`packages/networks/src/default-networks.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { DEFAULT_NETWORKS, DEFAULT_NETWORK_ID } from "./default-networks";

describe("DEFAULT_NETWORKS", () => {
  it("includes the default test13 network with correct RPC and chain id", () => {
    const test13 = DEFAULT_NETWORKS.find((n) => n.id === DEFAULT_NETWORK_ID);
    expect(test13).toMatchObject({
      chainId: "test-13",
      rpcUrl: "https://rpc.test13.testnets.gno.land",
      environment: "testnet",
      trust: "official",
      persistence: "rolling",
    });
  });

  it("every network has a websocket URL derived from its RPC URL", () => {
    for (const net of DEFAULT_NETWORKS) {
      expect(net.websocketUrl).toBe(net.rpcUrl.replace(/^http/, "ws") + "/websocket");
    }
  });
});
```

- [ ] **Step 3: Run to verify failure** — `pnpm --filter @gnomputer/networks test` → FAIL, module missing

- [ ] **Step 4: Implement network-config.ts**

```ts
import { z } from "zod";

export const NetworkConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  chainId: z.string(),
  rpcUrl: z.string().url(),
  websocketUrl: z.string().optional(),
  gnowebUrl: z.string().url().optional(),
  indexerGraphqlUrl: z.string().url().optional(),
  environment: z.enum(["mainnet", "betanet", "staging", "testnet", "local", "custom"]),
  persistence: z.enum(["persistent", "rolling", "ephemeral", "unknown"]),
  trust: z.enum(["official", "community", "local", "custom"]),
  capabilities: z.array(z.string()),
  warnings: z.array(z.object({ code: z.string(), message: z.string() })).optional(),
});
export type NetworkConfig = z.infer<typeof NetworkConfigSchema>;
```

- [ ] **Step 5: Implement default-networks.ts**

```ts
import type { NetworkConfig } from "./network-config";

export const DEFAULT_NETWORK_ID = "test13";

function withWebsocket(rpcUrl: string): string {
  return rpcUrl.replace(/^http/, "ws") + "/websocket";
}

export const DEFAULT_NETWORKS: NetworkConfig[] = [
  {
    id: "test13",
    name: "Test13 (official testnet)",
    chainId: "test-13",
    rpcUrl: "https://rpc.test13.testnets.gno.land",
    websocketUrl: withWebsocket("https://rpc.test13.testnets.gno.land"),
    gnowebUrl: "https://test13.testnets.gno.land",
    environment: "testnet",
    persistence: "rolling",
    trust: "official",
    capabilities: ["network.read"],
    warnings: [
      {
        code: "indexed-history-unavailable",
        message: "No public transaction indexer is configured for this network yet; recent activity is derived from live block/transaction subscription only.",
      },
    ],
  },
  {
    id: "betanet",
    name: "Betanet",
    chainId: "gnoland1",
    rpcUrl: "https://rpc.gno.land",
    websocketUrl: withWebsocket("https://rpc.gno.land"),
    gnowebUrl: "https://gno.land",
    environment: "betanet",
    persistence: "persistent",
    trust: "official",
    capabilities: ["network.read"],
  },
];
```

- [ ] **Step 6: index.ts barrel, run tests, verify pass**

Run: `pnpm --filter @gnomputer/networks test`
Expected: PASS (2 tests)

- [ ] **Step 7: Commit**

```bash
git add packages/networks
git commit -m "feat(networks): add NetworkConfig and default network registry"
```

---

## Task 5: `packages/rpc` — Tendermint2 adapter

**Files:**
- Create: `packages/rpc/package.json`, `packages/rpc/tsconfig.json`, `packages/rpc/src/index.ts`, `packages/rpc/src/client.ts`, `packages/rpc/src/queries.ts`, `packages/rpc/src/client.test.ts`
- Fixtures: `packages/rpc/src/__fixtures__/status.json`, `packages/rpc/src/__fixtures__/qrender.json`

**Interfaces:**
- Consumes: `NetworkConfig` from `@gnomputer/networks`, `wrapEnvelope`/`DataEnvelope` from `@gnomputer/core`
- Produces:
  - `function createRpcClient(network: NetworkConfig): RpcClient`
  - `interface RpcClient { getStatus(): Promise<DataEnvelope<{ latestHeight: number; chainId: string }>>; queryRender(packagePath: string, path: string, fetchedAt: string): Promise<DataEnvelope<string>>; queryFile(packagePath: string, fetchedAt: string): Promise<DataEnvelope<string>>; }`
  - This is the only package permitted to import `@gnolang/tm2-js-client`.

- [ ] **Step 1: Package scaffolding**

```json
{
  "name": "@gnomputer/rpc",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "lint": "eslint src",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@gnomputer/core": "workspace:*",
    "@gnomputer/networks": "workspace:*",
    "@gnolang/tm2-js-client": "^0.2.0"
  },
  "devDependencies": { "vitest": "^2.1.8", "typescript": "^5.7.0" }
}
```

- [ ] **Step 2: Record fixtures from the real network**

Run:
```bash
curl -s 'https://rpc.test13.testnets.gno.land/status' > packages/rpc/src/__fixtures__/status.json
curl -s 'https://rpc.test13.testnets.gno.land/abci_query?path=%22vm/qrender%22&data=%22gno.land/r/demo/wugnot:%22' > packages/rpc/src/__fixtures__/qrender.json
```
Expected: both files are non-empty JSON. If `gno.land/r/demo/wugnot` doesn't exist on
Test13, substitute any realm confirmed live at implementation time (check
`https://test13.testnets.gno.land/r/demo/` listing first) — the fixture just needs to be
a real, valid `abci_query` response shape.

- [ ] **Step 3: Write failing contract test**

`packages/rpc/src/client.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { createRpcClient } from "./client";
import { DEFAULT_NETWORKS } from "@gnomputer/networks";
import statusFixture from "./__fixtures__/status.json";
import qrenderFixture from "./__fixtures__/qrender.json";

const test13 = DEFAULT_NETWORKS[0]!;

describe("createRpcClient", () => {
  it("wraps getStatus in a DataEnvelope with source=rpc", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify(statusFixture))) as unknown as typeof fetch;
    const client = createRpcClient(test13);
    const env = await client.getStatus();
    expect(env.source).toBe("rpc");
    expect(env.consistency).toBe("authoritative");
    expect(typeof env.data.latestHeight).toBe("number");
  });

  it("wraps queryRender in a DataEnvelope", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify(qrenderFixture))) as unknown as typeof fetch;
    const client = createRpcClient(test13);
    const env = await client.queryRender("gno.land/r/demo/wugnot", "", "2026-07-22T00:00:00.000Z");
    expect(env.source).toBe("rpc");
    expect(typeof env.data).toBe("string");
  });
});
```

- [ ] **Step 4: Run to verify failure** — `pnpm --filter @gnomputer/rpc test` → FAIL, `./client` missing

- [ ] **Step 5: Implement queries.ts (raw ABCI query helpers)**

```ts
import { Tm2Client } from "@gnolang/tm2-js-client";

export function createTm2Client(rpcUrl: string): Tm2Client {
  return new Tm2Client(rpcUrl);
}

export async function abciQueryString(client: Tm2Client, path: string, data: string): Promise<string> {
  const result = await client.abciQuery(path, data);
  return new TextDecoder().decode(result.response.Value ? Buffer.from(result.response.Value, "base64") : Buffer.alloc(0));
}
```

(Exact `Tm2Client` method names are confirmed against `@gnolang/tm2-js-client`'s published
API during implementation — if the installed version's method signature differs from
`abciQuery(path, data)`, adjust this file to match the actual client API; the contract
test in Step 3 is what must pass, not this literal code.)

- [ ] **Step 6: Implement client.ts**

```ts
import type { NetworkConfig } from "@gnomputer/networks";
import { wrapEnvelope, type DataEnvelope } from "@gnomputer/core";
import { createTm2Client, abciQueryString } from "./queries";

export interface RpcClient {
  getStatus(): Promise<DataEnvelope<{ latestHeight: number; chainId: string }>>;
  queryRender(packagePath: string, path: string, fetchedAt: string): Promise<DataEnvelope<string>>;
  queryFile(packagePath: string, fetchedAt: string): Promise<DataEnvelope<string>>;
}

export function createRpcClient(network: NetworkConfig): RpcClient {
  const tm2 = createTm2Client(network.rpcUrl);

  const baseRef = { uri: `gno://${network.id}/network/${network.id}`, kind: "network" as const, networkId: network.id };

  return {
    async getStatus() {
      const res = await fetch(`${network.rpcUrl}/status`).then((r) => r.json());
      const latestHeight = Number(res.result.sync_info.latest_block_height);
      const chainId = String(res.result.node_info.network);
      return wrapEnvelope({
        ref: baseRef,
        data: { latestHeight, chainId },
        source: "rpc",
        consistency: "authoritative",
        networkId: network.id,
        chainId,
        height: latestHeight,
        fetchedAt: new Date().toISOString(),
        freshness: "live",
        schema: "gnomputer.rpc.status.v1",
      });
    },

    async queryRender(packagePath, path, fetchedAt) {
      const value = await abciQueryString(tm2, "vm/qrender", `${packagePath}:${path}`);
      return wrapEnvelope({
        ref: { ...baseRef, kind: "realm", packagePath },
        data: value,
        source: "rpc",
        consistency: "authoritative",
        networkId: network.id,
        fetchedAt,
        freshness: "live",
        schema: "gnomputer.rpc.render.v1",
      });
    },

    async queryFile(packagePath, fetchedAt) {
      const value = await abciQueryString(tm2, "vm/qfile", packagePath);
      return wrapEnvelope({
        ref: { ...baseRef, kind: "source-file", packagePath },
        data: value,
        source: "rpc",
        consistency: "authoritative",
        networkId: network.id,
        fetchedAt,
        freshness: "live",
        schema: "gnomputer.rpc.file.v1",
      });
    },
  };
}
```

- [ ] **Step 7: Run tests, adjust to actual `tm2-js-client` API until passing**

Run: `pnpm --filter @gnomputer/rpc test`
Expected: PASS. If the installed `@gnolang/tm2-js-client` version exposes a different
method name/signature than assumed in Step 5, update `queries.ts` only — `client.ts`'s
public interface must not change, since Task 9 (`app-sdk`) depends on it.

- [ ] **Step 8: Commit**

```bash
git add packages/rpc
git commit -m "feat(rpc): add Tendermint2 adapter wrapping status/qrender/qfile in DataEnvelope"
```

---

## Task 6: `packages/storage` — Dexie persistence

**Files:**
- Create: `packages/storage/package.json`, `packages/storage/tsconfig.json`, `packages/storage/src/index.ts`, `packages/storage/src/db.ts`, `packages/storage/src/db.test.ts`

**Interfaces:**
- Produces:
  - `interface WorkspaceRecord { id: string; name: string; networkId: string; openRefs: string[]; activeLens?: string; updatedAt: string }`
  - `interface TrailStepRecord { trailId: string; order: number; refUri: string; label: string; createdAt: string }`
  - `interface TrailRecord { id: string; name: string; createdAt: string; updatedAt: string }`
  - `interface FavoriteRecord { refUri: string; label: string; createdAt: string }`
  - `class GnomputerDB extends Dexie` with tables `workspaces`, `trails`, `trailSteps`, `favorites`
  - `function openDatabase(name?: string): GnomputerDB`

- [ ] **Step 1: Package scaffolding** (pattern per Task 2, name `@gnomputer/storage`, dependency `dexie: ^4.0.10`; add `fake-indexeddb` as a devDependency for Vitest)

- [ ] **Step 2: Write failing test**

`packages/storage/src/db.test.ts`:
```ts
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { openDatabase } from "./db";

describe("GnomputerDB", () => {
  beforeEach(async () => {
    indexedDB.deleteDatabase("gnomputer-test");
  });

  it("persists and restores a workspace", async () => {
    const db = openDatabase("gnomputer-test");
    await db.workspaces.put({
      id: "explore", name: "Explore", networkId: "test13", openRefs: [], updatedAt: "2026-07-22T00:00:00.000Z",
    });
    const found = await db.workspaces.get("explore");
    expect(found?.name).toBe("Explore");
  });

  it("persists Trail steps in order and restores them", async () => {
    const db = openDatabase("gnomputer-test");
    await db.trails.put({ id: "t1", name: "Untitled Trail", createdAt: "2026-07-22T00:00:00.000Z", updatedAt: "2026-07-22T00:00:00.000Z" });
    await db.trailSteps.bulkPut([
      { trailId: "t1", order: 0, refUri: "gno://test13/realm/gno.land/r/demo/foo", label: "Foo", createdAt: "2026-07-22T00:00:00.000Z" },
      { trailId: "t1", order: 1, refUri: "gno://test13/source-file/gno.land/r/demo/foo", label: "Foo source", createdAt: "2026-07-22T00:00:00.000Z" },
    ]);
    const steps = await db.trailSteps.where("trailId").equals("t1").sortBy("order");
    expect(steps.map((s) => s.label)).toEqual(["Foo", "Foo source"]);
  });
});
```

- [ ] **Step 3: Run to verify failure** — `pnpm --filter @gnomputer/storage test` → FAIL, `./db` missing

- [ ] **Step 4: Implement db.ts**

```ts
import Dexie, { type EntityTable } from "dexie";

export interface WorkspaceRecord {
  id: string;
  name: string;
  networkId: string;
  openRefs: string[];
  activeLens?: string;
  updatedAt: string;
}

export interface TrailRecord {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface TrailStepRecord {
  trailId: string;
  order: number;
  refUri: string;
  label: string;
  createdAt: string;
}

export interface FavoriteRecord {
  refUri: string;
  label: string;
  createdAt: string;
}

export class GnomputerDB extends Dexie {
  workspaces!: EntityTable<WorkspaceRecord, "id">;
  trails!: EntityTable<TrailRecord, "id">;
  trailSteps!: EntityTable<TrailStepRecord, "refUri">;
  favorites!: EntityTable<FavoriteRecord, "refUri">;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      workspaces: "id, networkId",
      trails: "id",
      trailSteps: "[trailId+order], trailId",
      favorites: "refUri",
    });
  }
}

export function openDatabase(name = "gnomputer"): GnomputerDB {
  return new GnomputerDB(name);
}
```

- [ ] **Step 5: Run tests, verify pass**

Run: `pnpm --filter @gnomputer/storage test`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add packages/storage
git commit -m "feat(storage): add Dexie schema for workspaces, trails and favorites"
```

---

## Task 7: `packages/trails` — Trail API

**Files:**
- Create: `packages/trails/package.json`, `packages/trails/tsconfig.json`, `packages/trails/src/index.ts`, `packages/trails/src/trail-api.ts`, `packages/trails/src/trail-api.test.ts`

**Interfaces:**
- Consumes: `GnomputerDB`, `TrailRecord`, `TrailStepRecord` from `@gnomputer/storage`
- Produces:
  - `interface TrailAPI { start(name: string): Promise<string>; addStep(trailId: string, refUri: string, label: string): Promise<void>; rename(trailId: string, name: string): Promise<void>; getSteps(trailId: string): Promise<TrailStepRecord[]>; getActiveTrailId(): Promise<string | null>; }`
  - `function createTrailApi(db: GnomputerDB): TrailAPI`

- [ ] **Step 1: Package scaffolding** (pattern per Task 2, name `@gnomputer/trails`, deps `@gnomputer/storage: workspace:*`, devDep `fake-indexeddb`)

- [ ] **Step 2: Write failing test**

`packages/trails/src/trail-api.test.ts`:
```ts
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { openDatabase } from "@gnomputer/storage";
import { createTrailApi } from "./trail-api";

describe("TrailAPI", () => {
  beforeEach(() => indexedDB.deleteDatabase("gnomputer-trails-test"));

  it("starts a Trail and records steps in order", async () => {
    const db = openDatabase("gnomputer-trails-test");
    const api = createTrailApi(db);
    const trailId = await api.start("Untitled Trail");
    await api.addStep(trailId, "gno://test13/realm/gno.land/r/demo/foo", "Foo");
    await api.addStep(trailId, "gno://test13/source-file/gno.land/r/demo/foo", "Foo source");

    const steps = await api.getSteps(trailId);
    expect(steps.map((s) => s.label)).toEqual(["Foo", "Foo source"]);
  });

  it("renames a Trail", async () => {
    const db = openDatabase("gnomputer-trails-test-2");
    const api = createTrailApi(db);
    const trailId = await api.start("Untitled Trail");
    await api.rename(trailId, "Investigate proposal 12");
    const trail = await db.trails.get(trailId);
    expect(trail?.name).toBe("Investigate proposal 12");
  });

  it("tracks the active Trail id across calls", async () => {
    const db = openDatabase("gnomputer-trails-test-3");
    const api = createTrailApi(db);
    const trailId = await api.start("Untitled Trail");
    expect(await api.getActiveTrailId()).toBe(trailId);
  });
});
```

- [ ] **Step 3: Run to verify failure** — FAIL, `./trail-api` missing

- [ ] **Step 4: Implement trail-api.ts**

```ts
import type { GnomputerDB } from "@gnomputer/storage";

export interface TrailAPI {
  start(name: string): Promise<string>;
  addStep(trailId: string, refUri: string, label: string): Promise<void>;
  rename(trailId: string, name: string): Promise<void>;
  getSteps(trailId: string): Promise<{ trailId: string; order: number; refUri: string; label: string; createdAt: string }[]>;
  getActiveTrailId(): Promise<string | null>;
}

function newId(): string {
  return `trail-${Math.random().toString(36).slice(2, 10)}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
}

export function createTrailApi(db: GnomputerDB): TrailAPI {
  let activeTrailId: string | null = null;

  return {
    async start(name) {
      const id = newId();
      const now = new Date().toISOString();
      await db.trails.put({ id, name, createdAt: now, updatedAt: now });
      activeTrailId = id;
      return id;
    },

    async addStep(trailId, refUri, label) {
      const existing = await db.trailSteps.where("trailId").equals(trailId).count();
      await db.trailSteps.put({ trailId, order: existing, refUri, label, createdAt: new Date().toISOString() });
      await db.trails.update(trailId, { updatedAt: new Date().toISOString() });
    },

    async rename(trailId, name) {
      await db.trails.update(trailId, { name, updatedAt: new Date().toISOString() });
    },

    async getSteps(trailId) {
      return db.trailSteps.where("trailId").equals(trailId).sortBy("order");
    },

    async getActiveTrailId() {
      return activeTrailId;
    },
  };
}
```

Note: `newId()`'s reliance on `Math.random()`/`crypto.randomUUID()` is fine at runtime;
it must never be memoized as a constant test fixture (each call is independent).

- [ ] **Step 5: Run tests, verify pass** — `pnpm --filter @gnomputer/trails test` → PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add packages/trails
git commit -m "feat(trails): add Trail API for starting, recording and renaming Trails"
```

---

## Task 8: `packages/lenses` — lens availability + realm render parser

**Files:**
- Create: `packages/lenses/package.json`, `packages/lenses/tsconfig.json`, `packages/lenses/src/index.ts`, `packages/lenses/src/availability.ts`, `packages/lenses/src/render-markup.ts`, `packages/lenses/src/availability.test.ts`, `packages/lenses/src/render-markup.test.ts`

**Interfaces:**
- Consumes: `EntityKind`, `LensId` from `@gnomputer/entities`
- Produces:
  - `function availableLenses(kind: EntityKind): LensId[]`
  - `function lensUnavailableReason(kind: EntityKind, lens: LensId): string | null`
  - `interface RenderNode { type: "text"|"heading"|"paragraph"|"link"|"code"|"list-item"; content?: string; href?: string; ref?: EntityRef; children?: RenderNode[] }`
  - `function parseRenderMarkup(markup: string, currentPackagePath: string): RenderNode[]`

- [ ] **Step 1: Package scaffolding** (pattern per Task 2, name `@gnomputer/lenses`, deps `@gnomputer/entities: workspace:*`)

- [ ] **Step 2: Write failing tests for lens availability**

`packages/lenses/src/availability.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { availableLenses, lensUnavailableReason } from "./availability";

describe("availableLenses", () => {
  it("realm supports experience, source, docs, state, history, actions, graph, raw", () => {
    expect(availableLenses("realm")).toEqual(
      expect.arrayContaining(["experience", "source", "docs", "state", "history", "actions", "graph", "raw"])
    );
  });

  it("transaction does not support the experience lens", () => {
    expect(availableLenses("transaction")).not.toContain("experience");
  });

  it("explains why an unavailable lens is unavailable", () => {
    expect(lensUnavailableReason("transaction", "experience")).toMatch(/not applicable/i);
  });

  it("returns null for an available lens", () => {
    expect(lensUnavailableReason("realm", "source")).toBeNull();
  });
});
```

- [ ] **Step 3: Write failing tests for render-markup parser**

`packages/lenses/src/render-markup.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseRenderMarkup } from "./render-markup";

describe("parseRenderMarkup", () => {
  it("parses a heading and paragraph", () => {
    const nodes = parseRenderMarkup("# Hello\n\nSome text.", "gno.land/r/demo/foo");
    expect(nodes[0]).toMatchObject({ type: "heading", content: "Hello" });
    expect(nodes[1]).toMatchObject({ type: "paragraph" });
  });

  it("resolves a relative realm link to an EntityRef", () => {
    const nodes = parseRenderMarkup("[Other realm](/r/demo/bar)", "gno.land/r/demo/foo");
    const link = nodes[0]!.children?.[0] ?? nodes[0];
    expect(link).toMatchObject({ type: "link", href: "/r/demo/bar" });
    expect(link!.ref?.packagePath).toBe("gno.land/r/demo/bar");
  });

  it("leaves external links unresolved (no ref)", () => {
    const nodes = parseRenderMarkup("[External](https://example.com)", "gno.land/r/demo/foo");
    const link = nodes[0]!.children?.[0] ?? nodes[0];
    expect(link!.ref).toBeUndefined();
  });
});
```

- [ ] **Step 4: Run to verify both fail** — modules missing

- [ ] **Step 5: Implement availability.ts**

```ts
import type { EntityKind, LensId } from "@gnomputer/entities";

const LENS_MATRIX: Record<EntityKind, LensId[]> = {
  network: ["state", "history", "raw"],
  realm: ["experience", "source", "docs", "state", "history", "actions", "graph", "raw"],
  package: ["source", "docs", "graph", "raw"],
  "source-file": ["source", "raw"],
  function: ["source", "docs", "actions", "raw"],
  type: ["source", "docs", "raw"],
  "state-object": ["state", "raw"],
  address: ["state", "history", "raw"],
  identity: ["experience", "state", "history", "raw"],
  account: ["state", "history", "actions", "raw"],
  balance: ["state", "raw"],
  transaction: ["history", "raw", "graph"],
  "transaction-message": ["history", "raw"],
  block: ["history", "raw"],
  event: ["history", "raw"],
  proposal: ["experience", "history", "actions", "raw"],
  validator: ["experience", "state", "history", "raw"],
  "local-workspace": ["source", "raw"],
  "local-file": ["source", "raw"],
  process: ["state", "raw"],
  trail: ["graph", "raw"],
};

export function availableLenses(kind: EntityKind): LensId[] {
  return LENS_MATRIX[kind] ?? ["raw"];
}

export function lensUnavailableReason(kind: EntityKind, lens: LensId): string | null {
  if (availableLenses(kind).includes(lens)) return null;
  return `The "${lens}" lens is not applicable to entities of kind "${kind}".`;
}
```

- [ ] **Step 6: Implement render-markup.ts**

```ts
import type { EntityRef } from "@gnomputer/entities";

export interface RenderNode {
  type: "text" | "heading" | "paragraph" | "link" | "code" | "list-item";
  content?: string;
  href?: string;
  ref?: EntityRef;
  children?: RenderNode[];
}

function resolveLink(href: string, currentPackagePath: string): EntityRef | undefined {
  if (/^https?:\/\//.test(href)) return undefined;
  if (!href.startsWith("/r/") && !href.startsWith("/p/")) return undefined;

  const domain = currentPackagePath.split("/")[0]!;
  const packagePath = `${domain}${href}`;
  return {
    uri: `gno://local/realm/${packagePath}`,
    kind: "realm",
    networkId: "local",
    packagePath,
  };
}

const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;

function parseInlineLinks(text: string, currentPackagePath: string): RenderNode[] {
  const nodes: RenderNode[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(LINK_RE)) {
    const [full, label, href] = match;
    const index = match.index ?? 0;
    if (index > lastIndex) {
      nodes.push({ type: "text", content: text.slice(lastIndex, index) });
    }
    nodes.push({ type: "link", content: label, href, ref: resolveLink(href!, currentPackagePath) });
    lastIndex = index + full!.length;
  }
  if (lastIndex < text.length) {
    nodes.push({ type: "text", content: text.slice(lastIndex) });
  }
  return nodes.length > 0 ? nodes : [{ type: "text", content: text }];
}

export function parseRenderMarkup(markup: string, currentPackagePath: string): RenderNode[] {
  const blocks = markup.split(/\n\n+/);
  const nodes: RenderNode[] = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (headingMatch) {
      nodes.push({ type: "heading", content: headingMatch[2] });
      continue;
    }

    if (/^```/.test(trimmed)) {
      nodes.push({ type: "code", content: trimmed.replace(/^```[a-z]*\n?/, "").replace(/```$/, "") });
      continue;
    }

    if (LINK_RE.test(trimmed)) {
      LINK_RE.lastIndex = 0;
      nodes.push({ type: "paragraph", children: parseInlineLinks(trimmed, currentPackagePath) });
      continue;
    }

    nodes.push({ type: "paragraph", content: trimmed });
  }

  return nodes;
}
```

- [ ] **Step 7: Run tests, verify pass** — `pnpm --filter @gnomputer/lenses test` → PASS (7 tests)

- [ ] **Step 8: Commit**

```bash
git add packages/lenses
git commit -m "feat(lenses): add lens availability matrix and Gno render-markup parser"
```

---

## Task 9: `packages/app-sdk` — the only import surface for apps

**Files:**
- Create: `packages/app-sdk/package.json`, `packages/app-sdk/tsconfig.json`, `packages/app-sdk/src/index.ts`, `packages/app-sdk/src/create-sdk.ts`, `packages/app-sdk/src/create-sdk.test.ts`

**Interfaces:**
- Consumes: `createRpcClient` (`@gnomputer/rpc`), `openDatabase` (`@gnomputer/storage`), `createTrailApi` (`@gnomputer/trails`), `DEFAULT_NETWORKS`/`DEFAULT_NETWORK_ID` (`@gnomputer/networks`), `availableLenses`/`parseRenderMarkup` (`@gnomputer/lenses`), `parseGnoUri`/`formatGnoUri` (`@gnomputer/entities`)
- Produces:
  - `interface GnomputerSDK { networks: { list(): NetworkConfig[]; getDefault(): NetworkConfig; getActive(): NetworkConfig; setActive(id: string): void }; rpc: RpcClient; trails: TrailAPI; entities: { parse: typeof parseGnoUri; format: typeof formatGnoUri }; lenses: { available: typeof availableLenses; parseRender: typeof parseRenderMarkup }; workspaces: { get(id: string): Promise<WorkspaceRecord | undefined>; save(record: WorkspaceRecord): Promise<void> }; favorites: { list(): Promise<FavoriteRecord[]>; toggle(refUri: string, label: string): Promise<void> } }`
  - `function createGnomputerSDK(options?: { networkId?: string; dbName?: string }): GnomputerSDK`

- [ ] **Step 1: Package scaffolding** (name `@gnomputer/app-sdk`, deps on all six packages above via `workspace:*`)

- [ ] **Step 2: Write failing test**

`packages/app-sdk/src/create-sdk.test.ts`:
```ts
import "fake-indexeddb/auto";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createGnomputerSDK } from "./create-sdk";
import statusFixture from "@gnomputer/rpc/src/__fixtures__/status.json";

describe("createGnomputerSDK", () => {
  beforeEach(() => {
    indexedDB.deleteDatabase("gnomputer-sdk-test");
    global.fetch = vi.fn(async () => new Response(JSON.stringify(statusFixture))) as unknown as typeof fetch;
  });

  it("defaults to the test13 network", () => {
    const sdk = createGnomputerSDK({ dbName: "gnomputer-sdk-test" });
    expect(sdk.networks.getActive().id).toBe("test13");
  });

  it("switches active network", () => {
    const sdk = createGnomputerSDK({ dbName: "gnomputer-sdk-test" });
    sdk.networks.setActive("betanet");
    expect(sdk.networks.getActive().id).toBe("betanet");
  });

  it("starts a Trail and records a step through the SDK", async () => {
    const sdk = createGnomputerSDK({ dbName: "gnomputer-sdk-test" });
    const trailId = await sdk.trails.start("Untitled Trail");
    await sdk.trails.addStep(trailId, "gno://test13/realm/gno.land/r/demo/foo", "Foo");
    const steps = await sdk.trails.getSteps(trailId);
    expect(steps).toHaveLength(1);
  });

  it("toggles a favorite", async () => {
    const sdk = createGnomputerSDK({ dbName: "gnomputer-sdk-test" });
    await sdk.favorites.toggle("gno://test13/realm/gno.land/r/demo/foo", "Foo");
    expect(await sdk.favorites.list()).toHaveLength(1);
    await sdk.favorites.toggle("gno://test13/realm/gno.land/r/demo/foo", "Foo");
    expect(await sdk.favorites.list()).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run to verify failure** — FAIL, `./create-sdk` missing

- [ ] **Step 4: Implement create-sdk.ts**

```ts
import { parseGnoUri, formatGnoUri } from "@gnomputer/entities";
import { DEFAULT_NETWORKS, DEFAULT_NETWORK_ID, type NetworkConfig } from "@gnomputer/networks";
import { createRpcClient, type RpcClient } from "@gnomputer/rpc";
import { openDatabase, type WorkspaceRecord, type FavoriteRecord } from "@gnomputer/storage";
import { createTrailApi, type TrailAPI } from "@gnomputer/trails";
import { availableLenses, parseRenderMarkup } from "@gnomputer/lenses";

export interface GnomputerSDK {
  networks: {
    list(): NetworkConfig[];
    getDefault(): NetworkConfig;
    getActive(): NetworkConfig;
    setActive(id: string): void;
  };
  rpc: RpcClient;
  trails: TrailAPI;
  entities: { parse: typeof parseGnoUri; format: typeof formatGnoUri };
  lenses: { available: typeof availableLenses; parseRender: typeof parseRenderMarkup };
  workspaces: {
    get(id: string): Promise<WorkspaceRecord | undefined>;
    save(record: WorkspaceRecord): Promise<void>;
  };
  favorites: {
    list(): Promise<FavoriteRecord[]>;
    toggle(refUri: string, label: string): Promise<void>;
  };
}

export function createGnomputerSDK(options: { networkId?: string; dbName?: string } = {}): GnomputerSDK {
  const db = openDatabase(options.dbName);
  const trailApi = createTrailApi(db);

  let activeNetwork = DEFAULT_NETWORKS.find((n) => n.id === (options.networkId ?? DEFAULT_NETWORK_ID))
    ?? DEFAULT_NETWORKS.find((n) => n.id === DEFAULT_NETWORK_ID)!;
  let rpc = createRpcClient(activeNetwork);

  return {
    networks: {
      list: () => DEFAULT_NETWORKS,
      getDefault: () => DEFAULT_NETWORKS.find((n) => n.id === DEFAULT_NETWORK_ID)!,
      getActive: () => activeNetwork,
      setActive: (id: string) => {
        const next = DEFAULT_NETWORKS.find((n) => n.id === id);
        if (!next) throw new Error(`Unknown network id "${id}"`);
        activeNetwork = next;
        rpc = createRpcClient(activeNetwork);
      },
    },
    get rpc() {
      return rpc;
    },
    trails: trailApi,
    entities: { parse: parseGnoUri, format: formatGnoUri },
    lenses: { available: availableLenses, parseRender: parseRenderMarkup },
    workspaces: {
      get: (id) => db.workspaces.get(id),
      save: (record) => db.workspaces.put(record).then(() => undefined),
    },
    favorites: {
      list: () => db.favorites.toArray(),
      toggle: async (refUri, label) => {
        const existing = await db.favorites.get(refUri);
        if (existing) {
          await db.favorites.delete(refUri);
        } else {
          await db.favorites.put({ refUri, label, createdAt: new Date().toISOString() });
        }
      },
    },
  } satisfies GnomputerSDK;
}
```

`get rpc()` above is written as an object getter for a plain object literal, which is
invalid JS — during implementation, replace the `get rpc() {...}` shorthand with a real
`Object.defineProperty(sdk, "rpc", { get: () => rpc })` after constructing the object, or
restructure `rpc` as a method `getRpc()` if a live getter proves awkward. Whichever is
chosen, the test in Step 2 must keep passing with `sdk.rpc` in Step 4's test replaced
consistently.

- [ ] **Step 5: Fix the getter, run tests, verify pass**

Run: `pnpm --filter @gnomputer/app-sdk test`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add packages/app-sdk
git commit -m "feat(app-sdk): compose entities/networks/rpc/trails/lenses/storage behind one SDK surface"
```

---

## Task 10: `apps/mock-server` — fixture-backed RPC double

**Files:**
- Create: `apps/mock-server/package.json`, `apps/mock-server/tsconfig.json`, `apps/mock-server/src/index.ts`, `apps/mock-server/src/fixtures.ts`, `apps/mock-server/src/server.test.ts`

**Interfaces:**
- Produces:
  - `function createMockServer(port?: number): { url: string; wsUrl: string; close(): Promise<void> }`
  - Serves `GET /status` and `GET /abci_query` matching the shapes recorded in
    `packages/rpc/src/__fixtures__`, plus a `/websocket` endpoint that emits one fake
    `NewBlock` event every 3 seconds so the Playwright "live activity" test has something
    to observe deterministically without waiting on the real chain.

- [ ] **Step 1: Package scaffolding** (name `@gnomputer/mock-server`, deps: `ws: ^8.18.0`; no framework needed — Node's built-in `http`)

- [ ] **Step 2: Write failing test**

`apps/mock-server/src/server.test.ts`:
```ts
import { describe, it, expect, afterEach } from "vitest";
import { createMockServer } from "./index";

describe("createMockServer", () => {
  let server: Awaited<ReturnType<typeof createMockServer>> | undefined;
  afterEach(async () => { await server?.close(); });

  it("serves /status", async () => {
    server = createMockServer(0);
    const res = await fetch(`${server.url}/status`);
    const body = await res.json();
    expect(body.result.node_info.network).toBeDefined();
  });

  it("serves /abci_query for vm/qrender", async () => {
    server = createMockServer(0);
    const res = await fetch(`${server.url}/abci_query?path=%22vm/qrender%22&data=%22gno.land/r/demo/foo:%22`);
    const body = await res.json();
    expect(body.result.response).toBeDefined();
  });
});
```

- [ ] **Step 3: Run to verify failure** — FAIL, module missing

- [ ] **Step 4: Copy the recorded fixtures into fixtures.ts**

```ts
import statusFixture from "../../../packages/rpc/src/__fixtures__/status.json";
import qrenderFixture from "../../../packages/rpc/src/__fixtures__/qrender.json";

export const FIXTURES = { status: statusFixture, qrender: qrenderFixture };
```

- [ ] **Step 5: Implement index.ts**

```ts
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { FIXTURES } from "./fixtures";

export function createMockServer(port = 0) {
  const server = createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    res.setHeader("access-control-allow-origin", "*");
    if (req.url?.startsWith("/status")) {
      res.end(JSON.stringify(FIXTURES.status));
      return;
    }
    if (req.url?.startsWith("/abci_query")) {
      res.end(JSON.stringify(FIXTURES.qrender));
      return;
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "not found" }));
  });

  const wss = new WebSocketServer({ server });
  const interval = setInterval(() => {
    for (const client of wss.clients) {
      client.send(JSON.stringify({ jsonrpc: "2.0", id: 0, result: { data: { type: "tendermint/event/NewBlock" } } }));
    }
  }, 3000);

  return new Promise<{ url: string; wsUrl: string; close(): Promise<void> }>((resolve) => {
    server.listen(port, () => {
      const address = server.address();
      const actualPort = typeof address === "object" && address ? address.port : port;
      resolve({
        url: `http://127.0.0.1:${actualPort}`,
        wsUrl: `ws://127.0.0.1:${actualPort}`,
        close: () =>
          new Promise((res) => {
            clearInterval(interval);
            wss.close();
            server.close(() => res());
          }),
      });
    });
  });
}
```

Adjust `createMockServer`'s return type in the test above from a plain object to
`Promise<...>` — Step 2's test must `await createMockServer(0)`; fix the test to match
before considering this step done.

- [ ] **Step 6: Run tests, verify pass** — `pnpm --filter @gnomputer/mock-server test` → PASS (2 tests)

- [ ] **Step 7: Commit**

```bash
git add apps/mock-server
git commit -m "feat(mock-server): fixture-backed RPC double for offline dev and e2e tests"
```

---

## Task 11: `apps/web` — Vite/React shell scaffold

**Files:**
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/vite.config.ts`, `apps/web/index.html`, `apps/web/src/main.tsx`, `apps/web/src/app.tsx`, `apps/web/src/sdk-context.tsx`, `apps/web/src/store.ts`, `apps/web/src/shell/top-bar.tsx`, `apps/web/src/shell/command-palette.tsx`

**Interfaces:**
- Consumes: `createGnomputerSDK`, `GnomputerSDK` from `@gnomputer/app-sdk`
- Produces:
  - `SdkProvider` React context exposing `useSdk(): GnomputerSDK`
  - `useShellStore` Zustand store: `{ activeNetworkId: string; commandPaletteOpen: boolean; guestLabel: string; setCommandPaletteOpen(open: boolean): void; setActiveNetwork(id: string): void }`

- [ ] **Step 1: Package scaffolding**

```json
{
  "name": "@gnomputer/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "lint": "eslint src",
    "typecheck": "tsc -b --noEmit",
    "e2e": "playwright test"
  },
  "dependencies": {
    "@gnomputer/app-sdk": "workspace:*",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "@tanstack/react-router": "^1.95.0",
    "@tanstack/react-query": "^5.62.0",
    "zustand": "^5.0.2"
  },
  "devDependencies": {
    "vite": "^6.0.5",
    "@vitejs/plugin-react": "^4.3.4",
    "vite-plugin-pwa": "^0.21.1",
    "@playwright/test": "^1.49.1",
    "vitest": "^2.1.8",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: vite.config.ts (base path for GitHub Pages)**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? "/",
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
        icons: [],
      },
    }),
  ],
});
```

- [ ] **Step 3: index.html**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Gnomputer — Boot the shared computer.</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: sdk-context.tsx**

```tsx
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createGnomputerSDK, type GnomputerSDK } from "@gnomputer/app-sdk";

const SdkContext = createContext<GnomputerSDK | null>(null);

export function SdkProvider({ children }: { children: ReactNode }) {
  const sdk = useMemo(() => createGnomputerSDK(), []);
  return <SdkContext.Provider value={sdk}>{children}</SdkContext.Provider>;
}

export function useSdk(): GnomputerSDK {
  const sdk = useContext(SdkContext);
  if (!sdk) throw new Error("useSdk() called outside <SdkProvider>");
  return sdk;
}
```

- [ ] **Step 5: store.ts (Zustand shell state)**

```ts
import { create } from "zustand";

interface ShellState {
  activeNetworkId: string;
  commandPaletteOpen: boolean;
  guestLabel: string;
  setCommandPaletteOpen: (open: boolean) => void;
  setActiveNetwork: (id: string) => void;
}

export const useShellStore = create<ShellState>((set) => ({
  activeNetworkId: "test13",
  commandPaletteOpen: false,
  guestLabel: "Browsing as guest",
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setActiveNetwork: (id) => set({ activeNetworkId: id }),
}));
```

- [ ] **Step 6: shell/top-bar.tsx**

```tsx
import { useSdk } from "../sdk-context";
import { useShellStore } from "../store";

export function TopBar() {
  const sdk = useSdk();
  const { activeNetworkId, guestLabel, setActiveNetwork, setCommandPaletteOpen } = useShellStore();

  return (
    <header className="top-bar" role="banner">
      <span className="top-bar__brand">Gnomputer</span>
      <label className="top-bar__network">
        Network
        <select
          value={activeNetworkId}
          onChange={(e) => {
            sdk.networks.setActive(e.target.value);
            setActiveNetwork(e.target.value);
          }}
        >
          {sdk.networks.list().map((n) => (
            <option key={n.id} value={n.id}>{n.name}</option>
          ))}
        </select>
      </label>
      <button type="button" onClick={() => setCommandPaletteOpen(true)} aria-label="Open command palette (Cmd+K)">
        Search…
      </button>
      <span className="top-bar__guest">{guestLabel}</span>
    </header>
  );
}
```

- [ ] **Step 7: shell/command-palette.tsx**

```tsx
import { useEffect, useState } from "react";
import { useShellStore } from "../store";

export function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen } = useShellStore();
  const [query, setQuery] = useState("");

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      }
      if (e.key === "Escape") setCommandPaletteOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  if (!commandPaletteOpen) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label="Command palette" className="command-palette">
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Open realm, address, transaction…"
      />
    </div>
  );
}
```

- [ ] **Step 8: app.tsx and main.tsx**

`apps/web/src/app.tsx`:
```tsx
import { SdkProvider } from "./sdk-context";
import { TopBar } from "./shell/top-bar";
import { CommandPalette } from "./shell/command-palette";

export function App() {
  return (
    <SdkProvider>
      <TopBar />
      <CommandPalette />
      <main>
        <p>You are browsing the shared computer.</p>
        <p>Open any program, user, function or transaction to follow it through the world.</p>
      </main>
    </SdkProvider>
  );
}
```

`apps/web/src/main.tsx`:
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 9: Verify it builds and runs**

Run: `pnpm --filter @gnomputer/web dev` (in background, then curl it)
Expected: dev server starts; `curl -s http://localhost:5173 | grep -q "Gnomputer"` succeeds.
Stop the dev server after verifying.

- [ ] **Step 10: Commit**

```bash
git add apps/web
git commit -m "feat(web): scaffold Vite/React shell with SDK provider, top bar and command palette"
```

---

## Task 12: Realm Browser + Source Explorer + Home + World Explorer routes, Trail auto-recording

**Files:**
- Create: `apps/web/src/routes/root.tsx`, `apps/web/src/routes/home.tsx`, `apps/web/src/routes/world-explorer.tsx`, `apps/web/src/routes/realm-browser.tsx`, `apps/web/src/routes/source-explorer.tsx`, `apps/web/src/use-trail-recorder.ts`, `apps/web/src/use-trail-recorder.test.tsx`
- Modify: `apps/web/src/app.tsx` (wire up TanStack Router)

**Interfaces:**
- Consumes: `sdk.rpc.queryRender`, `sdk.rpc.queryFile`, `sdk.lenses.parseRender`, `sdk.trails.*` from `useSdk()`
- Produces: `function useTrailRecorder(ref: { uri: string; label: string }): void` — on mount,
  ensures an active Trail exists (starting one on first navigation of the session) and
  appends a step for the given ref.

- [ ] **Step 1: Write failing test for the Trail recorder hook**

`apps/web/src/use-trail-recorder.test.tsx`:
```tsx
import "fake-indexeddb/auto";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createGnomputerSDK } from "@gnomputer/app-sdk";
import statusFixture from "@gnomputer/rpc/src/__fixtures__/status.json";
import { SdkProvider } from "./sdk-context";
import { useTrailRecorder } from "./use-trail-recorder";

describe("useTrailRecorder", () => {
  beforeEach(() => {
    indexedDB.deleteDatabase("gnomputer-trail-recorder-test");
    global.fetch = vi.fn(async () => new Response(JSON.stringify(statusFixture))) as unknown as typeof fetch;
  });

  it("starts a Trail on first use and records the visited ref", async () => {
    const sdk = createGnomputerSDK({ dbName: "gnomputer-trail-recorder-test" });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SdkProvider overrideSdk={sdk}>{children}</SdkProvider>
    );
    renderHook(() => useTrailRecorder({ uri: "gno://test13/realm/gno.land/r/demo/foo", label: "Foo" }), { wrapper });

    await waitFor(async () => {
      const trailId = await sdk.trails.getActiveTrailId();
      expect(trailId).not.toBeNull();
      const steps = await sdk.trails.getSteps(trailId!);
      expect(steps.map((s) => s.label)).toContain("Foo");
    });
  });
});
```

This test requires `SdkProvider` to accept an `overrideSdk` prop for test injection —
add that as an optional prop in Task 11's `sdk-context.tsx` (`overrideSdk?: GnomputerSDK`,
used instead of `useMemo(() => createGnomputerSDK(), [])` when provided). Add
`@testing-library/react` as a devDependency of `apps/web`.

- [ ] **Step 2: Run to verify failure** — FAIL, `./use-trail-recorder` missing

- [ ] **Step 3: Implement use-trail-recorder.ts**

```ts
import { useEffect, useRef } from "react";
import { useSdk } from "./sdk-context";

export function useTrailRecorder(ref: { uri: string; label: string }): void {
  const sdk = useSdk();
  const recordedFor = useRef<string | null>(null);

  useEffect(() => {
    if (recordedFor.current === ref.uri) return;
    recordedFor.current = ref.uri;

    void (async () => {
      let trailId = await sdk.trails.getActiveTrailId();
      if (!trailId) {
        trailId = await sdk.trails.start("Untitled Trail");
      }
      await sdk.trails.addStep(trailId, ref.uri, ref.label);
    })();
  }, [ref.uri, ref.label, sdk]);
}
```

- [ ] **Step 4: Run test, verify it passes** — `pnpm --filter @gnomputer/web test` → PASS

- [ ] **Step 5: Implement the four routes**

`apps/web/src/routes/realm-browser.tsx`:
```tsx
import { useEffect, useState } from "react";
import { useSdk } from "../sdk-context";
import { useTrailRecorder } from "../use-trail-recorder";
import type { RenderNode } from "@gnomputer/lenses";

export function RealmBrowser({ packagePath }: { packagePath: string }) {
  const sdk = useSdk();
  const [nodes, setNodes] = useState<RenderNode[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useTrailRecorder({ uri: `gno://${sdk.networks.getActive().id}/realm/${packagePath}`, label: packagePath });

  useEffect(() => {
    setNodes(null);
    setError(null);
    sdk.rpc
      .queryRender(packagePath, "", new Date().toISOString())
      .then((env) => setNodes(sdk.lenses.parseRender(env.data, packagePath)))
      .catch((err: Error) => setError(err.message));
  }, [packagePath, sdk]);

  if (error) return <div role="alert">Could not load this realm: {error}</div>;
  if (!nodes) return <div aria-busy="true">Loading realm…</div>;

  return (
    <article aria-label={`Realm ${packagePath}`}>
      {nodes.map((node, i) => (
        <RenderNodeView key={i} node={node} />
      ))}
    </article>
  );
}

function RenderNodeView({ node }: { node: RenderNode }) {
  switch (node.type) {
    case "heading":
      return <h2>{node.content}</h2>;
    case "code":
      return <pre>{node.content}</pre>;
    case "link":
      return <a href={node.href}>{node.content}</a>;
    case "paragraph":
      return <p>{node.content ?? node.children?.map((c, i) => <RenderNodeView key={i} node={c} />)}</p>;
    default:
      return <span>{node.content}</span>;
  }
}
```

`apps/web/src/routes/source-explorer.tsx`:
```tsx
import { useEffect, useState } from "react";
import { useSdk } from "../sdk-context";
import { useTrailRecorder } from "../use-trail-recorder";

export function SourceExplorer({ packagePath }: { packagePath: string }) {
  const sdk = useSdk();
  const [source, setSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useTrailRecorder({ uri: `gno://${sdk.networks.getActive().id}/source-file/${packagePath}`, label: `${packagePath} (source)` });

  useEffect(() => {
    setSource(null);
    setError(null);
    sdk.rpc
      .queryFile(packagePath, new Date().toISOString())
      .then((env) => setSource(env.data))
      .catch((err: Error) => setError(err.message));
  }, [packagePath, sdk]);

  if (error) return <div role="alert">Could not load source: {error}</div>;
  if (!source) return <div aria-busy="true">Loading source…</div>;

  return (
    <section aria-label={`Source for ${packagePath}`}>
      <pre>{source}</pre>
    </section>
  );
}
```

`apps/web/src/routes/home.tsx`:
```tsx
import { RealmBrowser } from "./realm-browser";
import { SourceExplorer } from "./source-explorer";

const FEATURED_PACKAGE = "gno.land/r/demo/wugnot";

export function Home() {
  return (
    <div className="home-layout">
      <RealmBrowser packagePath={FEATURED_PACKAGE} />
      <SourceExplorer packagePath={FEATURED_PACKAGE} />
    </div>
  );
}
```

(`FEATURED_PACKAGE` must be replaced at implementation time with a realm confirmed live
on Test13 — check `https://test13.testnets.gno.land/` for the current curated/featured
list, since which demo realms are deployed can change between the research date above
and implementation.)

`apps/web/src/routes/world-explorer.tsx`:
```tsx
import { useEffect, useState } from "react";
import { useSdk } from "../sdk-context";

export function WorldExplorer() {
  const sdk = useSdk();
  const [favorites, setFavorites] = useState<{ refUri: string; label: string }[]>([]);

  useEffect(() => {
    sdk.favorites.list().then(setFavorites);
  }, [sdk]);

  return (
    <section aria-label="World Explorer">
      <h2>World Explorer</h2>
      <ul>
        {favorites.map((f) => (
          <li key={f.refUri}>{f.label}</li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 6: Wire routes into app.tsx with TanStack Router**

`apps/web/src/routes/root.tsx`:
```tsx
import { createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from "@tanstack/react-router";
import { Home } from "./home";
import { WorldExplorer } from "./world-explorer";

const rootRoute = createRootRoute({ component: () => <Outlet /> });
const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: Home });
const worldRoute = createRoute({ getParentRoute: () => rootRoute, path: "/world", component: WorldExplorer });

const routeTree = rootRoute.addChildren([homeRoute, worldRoute]);
export const router = createRouter({ routeTree, basepath: import.meta.env.BASE_URL });

export function AppRouter() {
  return <RouterProvider router={router} />;
}
```

Update `apps/web/src/app.tsx` to render `<AppRouter />` in place of the static `<main>`
block from Task 11 Step 8, keeping `<TopBar />` and `<CommandPalette />` above it.

- [ ] **Step 7: Manual verification against the real network**

Run: `pnpm --filter @gnomputer/web dev`, open `http://localhost:5173` in a browser.
Expected: the featured realm's rendered output and its source appear side by side within
a couple seconds, with no wallet prompt, and the copy "You are browsing the shared
computer." is visible somewhere on first load (move it into `Home` if Task 11's static
copy was replaced by the router in Step 6).

- [ ] **Step 8: Commit**

```bash
git add apps/web
git commit -m "feat(web): add Home/World Explorer/Realm Browser/Source Explorer routes with Trail auto-recording"
```

---

## Task 13: Playwright e2e against the mock server

**Files:**
- Create: `apps/web/playwright.config.ts`, `apps/web/e2e/guest_boot_shared_computer.spec.ts`, `apps/web/e2e/realm_source_live_activity.spec.ts`

**Interfaces:**
- Consumes: `createMockServer` from `@gnomputer/mock-server` (as a Playwright global setup, or spawned per-test)

- [ ] **Step 1: playwright.config.ts**

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  webServer: {
    command: "pnpm --filter @gnomputer/web dev -- --port 5183",
    port: 5183,
    reuseExistingServer: !process.env.CI,
  },
  use: { baseURL: "http://localhost:5183" },
});
```

- [ ] **Step 2: guest_boot_shared_computer.spec.ts**

```ts
import { test, expect } from "@playwright/test";

test("guest can boot the shared computer with no wallet prompt", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("You are browsing the shared computer.")).toBeVisible();
  await expect(page.getByText(/browsing as guest/i)).toBeVisible();
  await expect(page.getByText(/connect wallet/i)).toHaveCount(0);
});
```

- [ ] **Step 3: realm_source_live_activity.spec.ts**

```ts
import { test, expect } from "@playwright/test";

test("realm and its source render side by side on first load", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("article")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("region", { name: /^Source for/ })).toBeVisible({ timeout: 10_000 });
});
```

- [ ] **Step 4: Run e2e, verify both pass**

Run: `pnpm --filter @gnomputer/web e2e`
Expected: 2 passed. If the app is still pointed at the live Test13 RPC rather than
`mock-server` at this point, that's acceptable for this slice as long as the tests pass
reliably — wiring an env-var switch (`VITE_MOCK_RPC=1`) to point `createRpcClient` at
`mock-server`'s URL during `e2e` is a reasonable follow-up but not required for Slice 1
to be demoable, since the plan's own acceptance demo (Task 15) runs against the real
network.

- [ ] **Step 5: Commit**

```bash
git add apps/web/playwright.config.ts apps/web/e2e
git commit -m "test(web): add Playwright specs for guest boot and realm/source live view"
```

---

## Task 14: CI and GitHub Pages deployment

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `apps/web/scripts/spa-fallback.mjs`
- Modify: `apps/web/package.json` (add `postbuild` script)

- [ ] **Step 1: CI workflow (PRs and pushes)**

`.github/workflows/ci.yml`:
```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - run: npm i -g pnpm@9.15.0
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build
```

- [ ] **Step 2: spa-fallback.mjs (GitHub Pages history-mode routing)**

`apps/web/scripts/spa-fallback.mjs`:
```js
import { copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dist = path.join(fileURLToPath(new URL("..", import.meta.url)), "dist");
await copyFile(path.join(dist, "index.html"), path.join(dist, "404.html"));
```

Add to `apps/web/package.json` scripts: `"postbuild": "node scripts/spa-fallback.mjs"`.

- [ ] **Step 3: Deploy workflow**

`.github/workflows/deploy.yml`:
```yaml
name: Deploy
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
concurrency: { group: "pages", cancel-in-progress: true }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - run: npm i -g pnpm@9.15.0
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @gnomputer/web build
        env:
          VITE_BASE_PATH: /gnomputer/
      - uses: actions/upload-pages-artifact@v3
        with: { path: apps/web/dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: { name: github-pages, url: ${{ steps.deployment.outputs.page_url }} }
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml .github/workflows/deploy.yml apps/web/scripts/spa-fallback.mjs apps/web/package.json
git commit -m "ci: add lint/test/build workflow and GitHub Pages deployment"
```

- [ ] **Step 5: Note manual one-time repo setting**

GitHub Pages must be switched to "GitHub Actions" as its source under the repo's Settings
→ Pages before `deploy.yml` will publish successfully — this is a one-time dashboard
setting this plan cannot make from the CLI; mention it in the final report rather than
silently assuming it's already set.

---

## Task 15: ADRs and README

**Files:**
- Create: `docs/adr/ADR-001-pwa-first-execution-model.md`, `docs/adr/ADR-002-entityref-and-lenses.md`, `docs/adr/ADR-003-trails-as-core-primitive.md`, `docs/adr/ADR-004-data-envelope-and-provenance.md`, `docs/adr/ADR-012-indexer-discovery-rpc-confirmation.md`, `README.md`

Each ADR follows the same short template — context / decision / consequences — populated
from the design doc (`docs/superpowers/specs/2026-07-22-slice-1-boot-experience-design.md`)
and the spec (`docs/product/gnomputer-spec.md`):

- [ ] **Step 1: ADR-001**

```markdown
# ADR-001: PWA-first execution model

## Context
Gnomputer's spec (docs/product/gnomputer-spec.md §11) defines three execution layers:
PWA, a local companion daemon, and eventual Tauri packaging. Slice 1 must decide which
layer to build first.

## Decision
Ship as an installable web PWA with zero-install guest access. No companion or Tauri
this slice. All read-only browsing (realms, source, activity) works with nothing beyond
a browser tab.

## Consequences
Every feature in Slice 1 must degrade gracefully with no local process available.
Wallet, signing, local filesystem, and process management are deferred to their own
phases (spec §34 Phase 7+).
```

- [ ] **Step 2: ADR-002**

```markdown
# ADR-002: EntityRef and lenses

## Context
Every object in Gnomputer needs a canonical, shareable identity and a predictable set of
views (spec §8-9).

## Decision
All objects are addressed by a `gno://<network>/<kind>/<path>` URI and modeled as an
`EntityRef` (packages/entities). Views are exposed as a fixed `LensId` enum (experience,
source, docs, state, history, actions, graph, raw, time); availability per entity kind is
a static matrix (packages/lenses), and unavailable lenses render an explicit reason
rather than an empty or broken view.

## Consequences
New entity kinds require updating both the URI parser's `PATH_KIND_MAP` and the lens
availability matrix in the same change — they're deliberately kept next to each other in
packages/entities and packages/lenses to make that easy to catch in review.
```

- [ ] **Step 3: ADR-003**

```markdown
# ADR-003: Trails as the core primitive

## Context
Spec §4 identifies the Trail — a persistent, inspectable path through the shared
computer — as Gnomputer's distinctive product primitive, not an afterthought feature.

## Decision
Trail recording starts automatically on first navigation (no explicit "start" action
required from the user) and every subsequent entity view appends a step, persisted to
Dexie via packages/trails. Slice 1 ships recording, renaming, and reload-restoration
only — manual annotation, sharing, and Run-program conversion are later phases (spec §34
Phase 2+, Phase 5).

## Consequences
Every route component that renders an entity must call `useTrailRecorder` — this is a
convention, not yet mechanically enforced; a future slice should consider an ESLint rule
or a wrapping HOC once more than four route components exist.
```

- [ ] **Step 4: ADR-004**

```markdown
# ADR-004: DataEnvelope and provenance

## Context
Spec §10 requires every external or cached value to carry provenance so the UI never
silently presents derived data as authoritative.

## Decision
`packages/core`'s `DataEnvelope<T>` wraps every value crossing an adapter boundary with
`source`, `consistency`, `freshness`, and `fetchedAt`. `packages/rpc` is the only
producer this slice (source: "rpc", consistency: "authoritative", freshness: "live").

## Consequences
When the tx-indexer adapter is added (spec §34 Phase 2), its envelopes will carry
`source: "indexer"` / `consistency: "indexed"`, and any UI that mixes RPC- and
indexer-sourced data must visibly distinguish them per spec §10's core rule: "use the
indexer to discover, use the chain to confirm."
```

- [ ] **Step 5: ADR-012**

```markdown
# ADR-012: Indexer discovery deferred, RPC-only for Slice 1

## Context
Spec §34 Phase 2 adds a tx-indexer adapter; Slice 1 (Phase 0/1) does not require it.
Research on 2026-07-22 confirmed no publicly hosted GraphQL tx-indexer exists for the
official Test13 testnet — gnolang/tx-indexer is designed to be self-hosted against an
RPC endpoint.

## Decision
Slice 1 ships with RPC only (packages/rpc): status, vm/qfile, vm/qrender, vm/qeval, and
WebSocket block/tx subscription. "Recent activity" and Trail correlation to new
transactions are derived from the WebSocket subscription, not from indexed queries. The
network registry's `test13` entry carries a `warnings` entry stating that indexed
history is unavailable.

## Consequences
Any feature that needs GraphQL-style search or historical aggregation (spec §17.5
Transaction Explorer's search, §24 global search across transactions) waits for Phase 2,
when either a self-hosted tx-indexer is stood up or a public one becomes available.
```

- [ ] **Step 6: README.md**

```markdown
# Gnomputer

Boot the shared computer.

Gnomputer is the workstation for the Gno shared computer — realm browsing, source
inspection, transaction exploration, and (in later slices) governance, wallet
operations, and local development, unified into one inspectable environment.

## This repo right now

This is Slice 1: a guest-mode read-only PWA. See:

- `docs/product/gnomputer-spec.md` — the full canonical product spec.
- `docs/superpowers/specs/2026-07-22-slice-1-boot-experience-design.md` — what Slice 1
  actually builds and why.
- `docs/adr/` — architecture decision records.

## Development

```bash
npm i -g pnpm@9.15.0
pnpm install
pnpm dev      # apps/web on http://localhost:5173
pnpm test     # all package unit tests
pnpm --filter @gnomputer/web e2e   # Playwright
pnpm build
```

Default network: the official Gno testnet (Test13). Switch networks from the top bar.
```

- [ ] **Step 7: Commit**

```bash
git add docs/adr README.md
git commit -m "docs: add Slice 1 ADRs and project README"
```

---

## Task 16: Full local verification and push

**Files:** none created — verification only.

- [ ] **Step 1: Clean install**

Run: `rm -rf node_modules packages/*/node_modules packages/apps/*/node_modules apps/*/node_modules && pnpm install`
Expected: install completes with no errors.

- [ ] **Step 2: Full test suite**

Run: `pnpm test`
Expected: every package's Vitest suite passes.

- [ ] **Step 3: Lint and typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: no errors. Fix any that surface before proceeding — do not silence with
blanket `// eslint-disable` or `@ts-ignore`.

- [ ] **Step 4: Build**

Run: `pnpm build`
Expected: all packages and `apps/web` build successfully; `apps/web/dist/index.html`
exists.

- [ ] **Step 5: e2e**

Run: `pnpm --filter @gnomputer/web e2e`
Expected: both Playwright specs pass.

- [ ] **Step 6: Manual acceptance demo against the real network**

Run: `pnpm --filter @gnomputer/web dev`, then walk through spec §41's acceptance demo by
hand in a browser: open with no wallet → see realm+source+activity → open another realm
→ observe the Trail → switch networks → reload → confirm workspace/Trail restore. Note
any step that doesn't work in the final report rather than silently skipping it.

- [ ] **Step 7: Push**

```bash
git push -u origin main
```

Expected: push succeeds. Report the resulting commit range and remind the user to flip
the repo's Settings → Pages source to "GitHub Actions" (Task 14 Step 5) since that one
setting can't be made from the CLI.
