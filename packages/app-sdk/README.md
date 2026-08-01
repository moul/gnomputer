# @gnomputer/app-sdk

The one surface `apps/web` is allowed to use. `createGnomputerSDK()` wires
the network registry, the RPC client, the tx-indexer queries, IndexedDB
storage, Trails, entity URIs, and the lens parsers into a single
`GnomputerSDK` object.

This exists to be a boundary, and an eslint rule makes it one:
`@gnomputer/rpc` and `@gnomputer/storage` are banned from `apps/web/src/**`.
Without that, the app grows its own private notion of what the chain looks
like, scattered across components.

```ts
const sdk = await createGnomputerSDK();
```

Depends on all seven other workspace packages and nothing external at
runtime. Requires IndexedDB at construction.

## Three behaviours worth knowing before you rely on them

**`networks.setActiveConfig()` is the entry point that works for both known
and custom networks.** Custom networks are *not* tracked inside the SDK —
`apps/web`'s `custom-networks-store` persists them and hands the config in.

**`queryCache` holds 50 entries with true FIFO eviction.** Updating an
existing key does *not* refresh its position, so a hot key can still be
evicted by 50 subsequent writes.

**`uiState` shares the Dexie `meta` table with internal SDK state.** Keys are
namespaced `uiState:<key>` so they can't collide with things like Trails'
`activeTrailId`. Don't write to `meta` directly.

## Tests

`pnpm --filter @gnomputer/app-sdk test`
