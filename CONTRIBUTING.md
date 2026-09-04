# Contributing

## Setup

```bash
npm i -g pnpm@9.15.0
pnpm install
pnpm dev        # apps/web on http://localhost:5173
```

Everything else runs from the repo root and fans out across the workspace via
Turborepo:

```bash
pnpm typecheck
pnpm lint
pnpm test       # unit tests, all packages
pnpm build
pnpm --filter @gnomputer/web e2e    # Playwright
```

Run all five before opening a PR. CI runs the same set, and deploys are gated
on it.

## Layout

```
apps/web           the PWA — the only thing that ships
apps/mock-server    a fake RPC endpoint, used by the e2e suite
packages/entities   gno:// URIs, EntityRef, the LensId enum
packages/core       DataEnvelope — the provenance wrapper
packages/networks   the network registry and its schema
packages/rpc        chain adapter: Tendermint2 RPC + tx-indexer
packages/storage    IndexedDB schema (Dexie) and migrations
packages/lenses     rendering realm output into safe UI nodes
packages/trails     visit history
packages/app-sdk    the single surface apps are allowed to use
docs/adr            architecture decision records
```

**Apps may not import adapter packages directly.** `@gnomputer/rpc` and
`@gnomputer/storage` are banned from `apps/web/src/**` by an eslint
`no-restricted-imports` rule; go through `@gnomputer/app-sdk`. Tests are
exempt. This is the rule that keeps the app from growing its own private
notion of what the chain looks like.

## Decisions

`docs/adr/` holds the architecture decision records. Read the relevant one
before changing the thing it describes — several record conclusions that were
expensive to reach and are not obvious from the code. ADR-017, for example,
records that Gno RPC does not serve event subscriptions: the endpoint is up
and answers `status`, but `subscribe` returns `-32601 Method not found`.
Everything "live" in the app is a shared poll because of that, not by
preference.

If you change a decision, add an ADR rather than editing the old one.

### One pinned transitive dependency

`@gnolang/gno-js-client` and `@gnolang/tm2-js-client` come from the **registry**
now. They used to be installed from commit-pinned forks carrying
[gno-js-client#251](https://github.com/gnolang/gno-js-client/pull/251) (typed
ABCI errors) plus two install-mechanics patches; #251 shipped in
`gno-js-client@2.1.0`, and the install patches only ever mattered for a git
dependency — pnpm runs a `prepare` build for those, and gno-js-client's build
fails on ubuntu runners while succeeding on macOS
([#254](https://github.com/gnolang/gno-js-client/issues/254)). A registry
tarball ships `dist/` and runs no build, so none of that applies.

The `pnpm.overrides` entry for tm2-js-client went with them: both packages now
want `^2.0.4` and resolve to one copy on their own. That single copy still
matters — `GnoABCIError extends TM2Error`, so two copies make `instanceof`
silently return false across the boundary. The check is the test asserting a
thrown error is `instanceof NoRenderDeclError` in `packages/rpc/src/client.test.ts`.

**`@scure/base` is pinned to `2.2.0`, and that is not cosmetic.** `2.3.0` began
rejecting a non-safe-integer `limit`, and `@cosmjs/encoding`'s `fromBech32`
passes `limit = Infinity`. Every bech32 decode throws
`RangeError: limit: expected safe integer, got Infinity`, which takes out
`getStatus` and `getValidatorSet` — the Network Monitor and the Validator
Monitor, entirely. Measured: 2.2.0 works, 2.3.0 and 2.4.0 fail.

The override is written as `"@scure/base@^2": "2.2.0"` rather than
`"@scure/base"`: an unrelated dependency wants `^1`, and forcing that one to a
2.x release would break it instead.

Lift the pin when `@cosmjs/encoding` stops passing `Infinity`, not before. Until
then a `pnpm update` that floats this dependency breaks two apps with no
compile-time signal at all — the rpc package's tests are what catch it.

ADR-019 covers dependencies: upgrade one thing at a time with a reason, and
assess whether an advisory can actually reach a user before acting on it.
`pnpm audit` currently reports two high-severity findings that are dev-only
and not in the shipped bundle — the ADR shows the working, so nobody has to
redo it or learn to ignore the tool.

## Tests

Unit tests live next to what they test (`foo.ts` → `foo.test.ts`), run under
vitest.

The e2e suite runs against `apps/mock-server`, not a live chain — Playwright
starts both it and the dev server automatically. Specs that genuinely need the
real chain are tagged `@live` and excluded from the default run; run those
deliberately with `--grep @live`.

Three gates are worth knowing about because they fail PRs:

- **Coverage** is a ratchet, not a target. The thresholds in
  `apps/web/vite.config.ts` sit just under what `main` currently achieves.
  Raise them when coverage rises; don't lower them to make a PR pass. Measure
  on `main`, not on your branch — lazy-loaded modules stay in the denominator
  without contributing covered lines, so a branch that adds a lazy import
  reads lower than it should.
- **Contrast** (`apps/web/src/styles/contrast.test.ts`) parses `theme.css` and
  requires every accent and muted-text token to clear WCAG AA 4.5:1 against
  every surface, in every theme. Adding a theme means clearing that bar.
- **axe** (`apps/web/e2e/accessibility.spec.ts`) scans the desktop in all
  themes and every app for WCAG A/AA violations.
- **Release integrity** (`apps/web/scripts/check-release-integrity.mjs`, also
  part of `build`) checks that `version.json` names the same commit as the
  code beside it, that no source map is precached, and that every precached
  file exists. Each of those has a failure mode that is invisible until it
  is in front of users — a version mismatch, in particular, produces an
  update banner that reloading cannot clear.
- **Bundle budget** (`apps/web/scripts/check-bundle-budget.mjs`, run as part
  of `build`) caps what a *first visit* downloads, gzipped. Also a ratchet.
  It gates only the app shell — the per-app lazy chunks are reported but not
  capped, because nobody who never opens the Editor pays for its 145KB. If a
  change genuinely needs more, raise the number in the same PR and say why:
  it is a decision about what someone on a phone pays before the app does
  anything.

## Working habits that this codebase has learned the hard way

**Go looking for bugs by breaking things, not by reading code.** This is the
habit that has found the most, and it keeps finding things a green suite says
are fine. Point the app at a chain that does not answer. Open a realm that does
not exist. Switch network with a window open. Reload with storage already
populated, which is the state every returning visitor is actually in. The
audit's own P0/P1 sweep found less than one afternoon of doing this did, and
every serious bug in the network-switching work — a shared link opening the
wrong realm, a realm opened from a link never being saved, a desktop remounting
on every cold load — came out of driving the app, not inspecting it. Reading
finds what you thought of; probing finds what you did not.

**Verify in a real browser before committing.** Several things here look right
in the diff and are wrong on screen. A green test suite is not the same as a
working feature.

**Verify on the deployed site too, not only locally.** Production differs in
ways that hide bugs: a service worker serves the previous build until it
updates, and a warm cache changes timing enough to expose races a cold local
run never hits. The switch overlay never appeared in production for exactly
that reason, while working every time locally.

**Check that a regression test fails without the fix.** A test written after
the fact often passes against the old code too, which means it guards nothing.
Revert the fix, watch it fail, put it back. When a guard cannot be made to fail
— a race whose ordering the test environment will not reproduce, say — say so
in the PR rather than letting a passing test imply cover it does not give. Two
real bugs shipped this way; both are noted where the tests live.

**Resolve CSS conflicts by hand, then check the braces balance.** A scripted
merge once left two unclosed braces in `shell.css`. CSS nesting makes that
*silently valid* — the browser reparses everything after as nested rules and
drops it, with no error anywhere. It shipped and went unnoticed for hours.

**Don't cherry-pick from a findings list.** When merging one issue's findings
into another, diff the lists. Hand-picking "the important ones" is how a real
bug got dropped and later arrived as a user report.

## Pull requests

One change per PR, with the reasoning in the description — what was actually
broken, how you know, and what you verified. Add a `CHANGELOG.md` entry for
anything user-facing, newest first, describing the effect rather than the
patch.

Commit messages follow Conventional Commits (`fix(a11y):`, `perf:`, `docs:`).
PRs are squash-merged, so the PR title becomes the commit.

## Security

Don't open a public issue for a vulnerability — see [SECURITY.md](SECURITY.md).
