# ADR-019: Dependencies are upgraded on evidence, not on a schedule

## Status

Accepted.

## Context

The audit (AUD-057) asked for a plan for dependency migrations rather than
bulk upgrades. Two things prompted it: a bulk upgrade is the kind of change
that is impossible to review and bisects badly when it breaks something, and
`pnpm audit` reports findings that look alarming without saying whether they
can affect anyone.

Both are worth a written rule, because the default behaviour under time
pressure is to run `pnpm update` and hope.

## Decision

### An advisory is assessed before it is acted on

The question is not "is there an advisory" but **"can it reach a user"**.
Three things decide that: is the package in `dependencies` or
`devDependencies`; does it end up in the shipped bundle; and is the
vulnerable code path reachable with input an attacker controls.

Recorded here as the worked example, measured 2026-08-02:

```
$ pnpm audit
vulnerabilities: {"info":0,"low":0,"moderate":0,"high":2,"critical":0}
  high: brace-expansion — DoS via unbounded expansion length
```

Two high-severity findings, and **neither is shipped**. `pnpm why` puts every
copy under `eslint`, `@vitest/coverage-v8` and `typescript-eslint` — all dev
tooling. There are no production dependency trees containing it, and the
string appears nowhere in `apps/web/dist`. The reachable input is our own
glob patterns in our own config.

So: not urgent, not ignored. It gets fixed when those tools next move for
another reason. Writing that down is the point — otherwise the next person
sees "2 high" and either panics or learns to disregard the tool entirely.

### Upgrades are separate, reviewable changes

One dependency, or one coherent group, per pull request, with a reason. Not
"chore: update dependencies" touching forty lines of lockfile.

The gates that already exist do most of the verification: the bundle budget
catches a dependency that quietly doubles in size, the coverage ratchet
catches tests that stopped running, and the e2e suite catches behaviour
changes. A dependency upgrade that moves any of those numbers should say so
in its PR.

### Version floors that are not free to move

- **`@gnolang/tm2-js-client` and `@gnolang/tm2-rpc`** — the wire protocol.
  `@gnolang/gno-js-client` (see #91) depends on exact versions of these, so
  moving them independently is what would block adopting it.
- **`dexie`** — schema migrations are cumulative and each version block
  re-declares every prior store. A major upgrade needs the migration path
  checked against a database created by the current release, not a fresh one.
- **`vite-plugin-pwa` / `workbox-*`** — the service worker's update
  lifecycle is load-bearing and was got wrong once already (see the
  `skipWaiting` note in `vite.config.ts`). An upgrade here needs the update
  banner exercised by hand: install the old build, deploy the new one,
  confirm Refresh lands on the new one.
- **React 18 → 19** — not a small change here. The shell relies on
  `useLayoutEffect` ordering for popover placement and on effect timing for
  focus restoration, both of which have caused real bugs before.

### What is deliberately not adopted

Automated dependency PRs (Dependabot/Renovate). On a project this size they
produce more review load than they remove, and the failure mode — a merged
upgrade nobody assessed — is exactly what this ADR exists to prevent. The
manual check is `pnpm outdated` and `pnpm audit`, run deliberately.

## Consequences

- `pnpm audit` showing high-severity findings is not by itself a release
  blocker. Reachability is.
- A dependency upgrade PR that cannot explain what it fixes or enables
  should not be opened.
- The version floors above need re-checking when they are next touched;
  they are reasons, not permanent bans.
