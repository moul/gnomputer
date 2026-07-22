# Slice 1 — Boot Experience Design

**Date:** 2026-07-22
**Status:** Approved for planning
**Parent spec:** `docs/product/gnomputer-spec.md` (§35 Slice 1, §41 "Initial builder task")

## 1. Why this scope

`docs/product/gnomputer-spec.md` describes a multi-year product: 16 build phases, 9
vertical slices, ~20 bundled apps, a Go companion daemon, a plugin system, and Tauri
packaging. Building or even fully designing all of it at once would produce a shallow
plan. The spec already decomposes itself into vertical slices (§35) and gives an exact
brief for the first one (§41, "Initial builder task"). This document scopes that first
slice into a concrete, buildable design.

**In scope (per spec §35 Slice 1 / §41):**

- Monorepo foundations (pnpm workspaces + Turborepo).
- `EntityRef` and canonical `gno://` URIs (§8).
- The 9-lens system (§9): experience, source, docs, state, history, actions, graph, raw, time.
- `DataEnvelope` with provenance and freshness (§10).
- Internal SDK boundaries (§13).
- Shell: top bar, network selector, activity indicator, global search, guest identity,
  command palette, split panes, persistent workspace, history/favorites (§14, §15).
- First-run boot experience: live realm + source + recent activity, no wallet prompt (§7.1).
- Realm Browser (§17.3).
- Source Explorer (§17.4).
- Trail v1: auto-record, breadcrumb, rename, persist, restore (§4, §41.10).
- Network registry: default public network + custom networks + endpoint health (§23).

**Explicitly out of scope this slice** (per spec §41 exclusion list): wallet, signing,
Run Studio, Monaco, companion, local filesystem, Builder, Process Manager, plugins,
Tauri, generic (Level B+) state inspection.

## 2. Confirmed decisions

| Decision | Choice | Rationale |
|---|---|---|
| Default network | Official Gno testnet (currently **Test13**, chain id `test-13`, RPC `https://rpc.test13.testnets.gno.land`) | User preference; verified live via research (CORS-open, WS subscribe + `vm/qfile`/`vm/qrender`/`vm/qeval` all confirmed working) |
| Network selection | Dropdown in the top bar, backed by the network registry (§23) | User preference; also required by spec (custom networks, betanet/testnet/local) |
| Visual identity | Placeholder only — type-based logo, restrained palette, no mascot illustration yet | User preference; swappable later without architectural change |
| Deployment | Basic CI (lint/typecheck/test/build) + GitHub Pages | User preference |
| License | Apache 2.0 | User preference |
| tx-indexer | Not used this slice | No public GraphQL tx-indexer exists for Test13 (self-hosted only); matches spec's own phasing — indexer adapter is Phase 2, not Slice 1 |

## 3. Architecture decisions

### 3.1 Data layer

A `packages/rpc` adapter wraps `@gnolang/tm2-js-client` (official, maintained Tendermint2
JS client) for the read-only primitives this slice needs: `status`, `abci_query`
(`vm/qfile` for source, `vm/qrender` for realm render output, `vm/qeval` for read-only
state queries), and WebSocket `subscribe` for new blocks/txs. We depend on the official
client for correctness on wire-protocol details rather than hand-rolling Tendermint
JSON-RPC/base64 encoding, but no client type crosses the adapter boundary: every response
is re-validated with Zod and wrapped in a `DataEnvelope` (source: `"rpc"`) before
reaching `packages/app-sdk`. Apps never import `packages/rpc` directly (enforced, see
3.3).

`gnoweb` (`https://test13.testnets.gno.land/`) is recorded in the network registry only
as a health-check / "open in gnoweb" reference link — it is never embedded or scraped for
rendering (see 3.2).

No tx-indexer adapter exists this slice. "Recent activity" and the Trail's live-activity
correlation (§7.2) are derived entirely from the RPC WebSocket block/tx subscription.

### 3.2 Realm rendering

Realm `Render()` output is fetched via `vm/qrender` and rendered natively by Gnomputer,
not iframed from gnoweb. This is required by the spec, not just preferred: §17.3 requires
intercepting Gno links and generating action forms from exported functions, and §7.2's
first wow moment requires highlighting a source symbol when an activity entry
references it — none of this is achievable across an iframe boundary. `packages/lenses`
implements a small renderer for the render-markup subset Gno realms emit (a constrained
Markdown-like format), with links resolved to `EntityRef`s and routed through our own
router instead of following `href`s.

### 3.3 SDK boundary enforcement

The boundary in spec §13 ("apps must not access external systems directly") is enforced
mechanically, not just by convention: an ESLint rule (`no-restricted-imports` scoped by
path) blocks anything under `packages/apps/*` or `apps/web` from importing
`packages/rpc`, `packages/storage`'s Dexie internals, or any other adapter package
directly. Only `packages/app-sdk` may import adapters; everything else imports the SDK.

### 3.4 State & persistence

Zustand holds live, reactive workspace/UI state (open panes, active lens, selected
network, in-progress Trail). Dexie is the durable store (workspaces, Trails, favorites,
network registry, entity cache) per §22. Zustand writes through to Dexie on relevant
mutations (workspace layout change, Trail step added, favorite toggled); on boot, the SDK
hydrates the Zustand store from Dexie before the shell renders. Default workspace on
first run is "Explore" (§14.2), pre-populated with the first-run layout (§7.1).

### 3.5 Apps this slice

`apps/web` hosts four bundled apps: Home (live dashboard, §17.1 — scoped down to what
Slice 1's data supports: curated/recent realms, live activity, no proposals/validators
yet), World Explorer (§17.2), Realm Browser (§17.3), Source Explorer (§17.4).

`apps/mock-server` fakes the subset of Tendermint RPC actually used (`status`,
`abci_query` for the three query paths above, WebSocket block/tx subscribe) from
recorded fixtures, so Playwright and offline/local dev work deterministically without
depending on the real testnet being reachable or in a particular state.

### 3.6 Trail v1

Auto-records navigation into a compact breadcrumb (§4.2), persisted to Dexie via the
Trail API, restorable after reload. Manual annotation, sharing, replay, and Run-program
conversion are later phases — not built this slice.

### 3.7 Deployment

GitHub Actions runs lint + typecheck + test + build on every PR. On `main`, a second
job builds `apps/web` and deploys to GitHub Pages. Client-side routing uses TanStack
Router's history mode (not hash mode) so entity URLs stay clean and shareable per §8.1;
GitHub Pages' static-hosting limitation with history-mode SPAs is handled with the
standard `404.html`-copy-of-`index.html` fallback trick, plus a Vite `base` path matching
the repository name.

### 3.8 Tooling note

The dev machine's Node (v25.8.2) no longer bundles `corepack`. `pnpm` will be installed
directly (`npm i -g pnpm` or the standalone installer) rather than via `corepack enable`.

## 4. ADRs written this slice

Per spec §32, the ADRs relevant to Slice 1's scope:

- `ADR-001-pwa-first-execution-model.md`
- `ADR-002-entityref-and-lenses.md`
- `ADR-003-trails-as-core-primitive.md`
- `ADR-004-data-envelope-and-provenance.md`
- `ADR-012-indexer-discovery-rpc-confirmation.md` (noting indexer deliberately deferred
  to Phase 2 — no public indexer for Test13, and RPC-only is sufficient for Slice 1's
  acceptance demo)

Remaining ADRs (companion security, plugin capabilities, time-travel labels, identity
provider adapters, workspace layout, realm adapter compatibility, transaction intent
protocol) are out of scope until their owning phase/slice.

## 5. Testing

- **Unit (Vitest):** `EntityRef`/URI parsing, `DataEnvelope` validation, lens
  availability rules, Trail serialization, RPC adapter fixture-based contract tests.
- **E2E (Playwright), against `apps/mock-server`:**
  - `guest_boot_shared_computer.spec.ts`
  - `realm_source_live_activity.spec.ts`
  (both from spec §33; the remaining required Playwright flows belong to later slices)
- Loading, empty, offline, and error states are required UI states for every view built
  this slice (§41.12), not follow-up work.

## 6. Acceptance demo

Directly from spec §41:

1. Open with no wallet.
2. Immediately see a live realm, source and activity.
3. Open another realm or imported package.
4. Observe the Trail update.
5. Open source beside the realm.
6. Switch networks.
7. Reload.
8. Confirm workspace and Trail restoration.

## 7. Explicitly excluded this slice

Wallet, signing, Run Studio, Monaco, companion, local filesystem access, Builder,
Process Manager, plugins, Tauri, generic (Level B+) state inspection, tx-indexer
adapter, GovDAO/Users/Bank/Validator/Network Monitor apps (later slices per §35).
