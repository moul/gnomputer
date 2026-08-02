# @gnomputer/storage

The IndexedDB schema. A Dexie subclass, `GnomputerDB`, plus its migrations.

Tables: `trails`, `trailSteps`, `favorites`, `meta`, `queryCache`,
`scripts`.

`workspaces` was here from v1 to v3 and is dropped in v4 — it shipped with
an SDK and never had a UI, so the schema claimed a feature the app did not
have. See the v4 comment in `db.ts` for why a named workspace should be
re-derived from the URL/layout schema rather than revived from that record
type.

## Exports

`GnomputerDB`, `openDatabase(name = "gnomputer")`, and the record types for
each table.

> **Apps must not import this package.** An eslint `no-restricted-imports`
> rule bans `@gnomputer/storage` from `apps/web/src/**`. Use
> `@gnomputer/app-sdk`. Tests are exempt.

Browser-only in practice. Tests must `import "fake-indexeddb/auto"` before
anything else.

## Adding or removing a table

Dexie versions are cumulative and each `.version(n).stores({...})` re-declares
the **full** store map. Four versions today: v1 base, v2 adds `queryCache`,
v3 adds `scripts`, v4 drops `workspaces`. A change means a new version block
that repeats every other store, not an edit to an existing one — the old
blocks are what Dexie upgrades *from*, so editing them changes history
rather than the schema.

Removing a table needs an explicit `tableName: null` in the new version.
Leaving it out of the new store map **keeps** it in the file — which looks
done, isn't, and is the sort of thing a migration test earns its place by
catching (`db.test.ts`, "v4 drops the workspaces store").

## Why there are sequence columns

`ScriptRecord.updatedSeq` and `QueryCacheRecord.insertSeq` exist because
millisecond-resolution `updatedAt` ties break "most recently updated first"
ordering when two writes land in the same event-loop tick. They are the
indexed sort keys (`scripts: "id, updatedSeq"`, `queryCache: "key, insertSeq"`),
not decoration.

## Tests

`pnpm --filter @gnomputer/storage test`
