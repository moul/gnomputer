# @gnomputer/trails

The Trail primitive from ADR-003: an ordered record of the entities you've
visited, with one "active trail" at a time.

## Exports

`createTrailApi(db)` returning a `TrailAPI` — `start`, `addStep`, `rename`,
`getSteps`, `getActiveTrailId`, `ensureActiveTrailId`, `listTrails`,
`setActiveTrail` — plus `TrailSummary`.

Takes an injected `GnomputerDB`, so it needs IndexedDB. Reached from the app
through `sdk.trails`; `apps/web` never imports this package directly.

## Every mutation is serialized

All writes funnel through an internal promise queue. This is not caution for
its own sake: the writes here are read-modify-write against IndexedDB, and
two sibling components recording a step on mount is the normal case, not an
edge case. Without the queue they clobber each other's steps or each create
their own "active" trail.

If you add a mutating method, put it on the queue.

## "Clear history" doesn't delete anything

It starts a fresh Trail and repoints `activeTrailId`. Old rows stay in
`db.trails` and accumulate — `listTrails()` exists so they remain reachable
rather than becoming invisible garbage.

The active trail id lives in the shared `meta` table under `activeTrailId`.

## Tests

`pnpm --filter @gnomputer/trails test`
