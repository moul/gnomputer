# @gnomputer/storage

The IndexedDB schema. A Dexie subclass, `GnomputerDB`, plus its migrations.

Tables: `workspaces`, `trails`, `trailSteps`, `favorites`, `meta`,
`queryCache`, `scripts`.

## Exports

`GnomputerDB`, `openDatabase(name = "gnomputer")`, and the record types for
each table.

> **Apps must not import this package.** An eslint `no-restricted-imports`
> rule bans `@gnomputer/storage` from `apps/web/src/**`. Use
> `@gnomputer/app-sdk`. Tests are exempt.

Browser-only in practice. Tests must `import "fake-indexeddb/auto"` before
anything else.

## Adding a table

Dexie versions are cumulative and each `.version(n).stores({...})` re-declares
the **full** store map. There are three versions today (v1 base, v2 adds
`queryCache`, v3 adds `scripts`). A new table means a new version block that
repeats every prior store, not an edit to the existing one.

## Why there are sequence columns

`ScriptRecord.updatedSeq` and `QueryCacheRecord.insertSeq` exist because
millisecond-resolution `updatedAt` ties break "most recently updated first"
ordering when two writes land in the same event-loop tick. They are the
indexed sort keys (`scripts: "id, updatedSeq"`, `queryCache: "key, insertSeq"`),
not decoration.

## Tests

`pnpm --filter @gnomputer/storage test`
