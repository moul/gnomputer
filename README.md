# Gnomputer

Boot the shared computer.

Gnomputer is the workstation for the Gno shared computer — realm browsing, source
inspection, live chain activity, network and validator health, and (in later slices)
governance actions, wallet operations, and local development, unified into one
inspectable environment.

## This repo right now

This is Slice 1 (plus follow-on features built past its original scope): a guest-mode
read-only PWA with a windowed desktop interface. See:

- `docs/product/gnomputer-spec.md` — the full canonical product spec.
- `docs/superpowers/specs/2026-07-22-slice-1-boot-experience-design.md` — what Slice 1
  actually builds and why.
- `docs/superpowers/plans/2026-07-22-slice-1-boot-experience.md` — the implementation
  plan this slice was built from.
- `docs/adr/` — architecture decision records.

### What's in the desktop

Everything below is real, live data from Gno testnets (default: Topaz; also Test13,
betanet, and a local `gnodev` option) — no mocked or fabricated content in the running
app:

- **Realm Browser** — a realm's rendered output, with Gno's own internal link/pagination
  routing followed generically; multiple tabs per window, and multiple windows at once
  (pop out a tab into its own window). Source lens shows the realm's file tree and
  source, fetched directly from the chain.
- **Recent Blocks** — polls block headers live; height, real transaction counts, time,
  with a filter for blocks that actually contain transactions.
- **Network Monitor** — chain ID, live height, measured RPC latency, endpoint trust.
- **Validator Monitor** — the full live validator set: address, voting power, proposer
  priority.
- **Block Explorer** — look up any block by height; header detail plus a real
  per-transaction list (success, gas used/wanted, decoded event types).
- **Event Explorer** — a live stream of decoded chain events as new blocks land.
- **Gnockpit** — a compact chain/validator summary with a link out to the full
  Gnockpit instance for the active network, when one is configured.
- **User Info** — address lookup: balance, account number, sequence, deployed package
  count, and a link to the same address on gnoweb.
- **History** — every realm/block/address you've visited this session, recorded as a
  Trail.
- **Settings** — Network (switch networks, see all known endpoints for one), User
  (guest identity, address lookup), and Theme (ASCII/Clean, each in light and dark).

Windows are draggable, resizable, minimizable, and closable; unopened apps live behind
an Apps start-menu and a Settings gear in the top bar. Layout, theme, and zoom persist
across reloads. The shell is responsive down to phone widths — a fresh mobile visit
gets a more zoomed-out, maximized-window default.

## Development

```bash
npm i -g pnpm@9.15.0
pnpm install
pnpm dev      # apps/web on http://localhost:5173
pnpm test     # all package unit tests
pnpm --filter @gnomputer/web e2e   # Playwright
pnpm build
```

Default network: Topaz. Switch networks from the top bar (Network settings), which
also lists every other endpoint (gnoweb, tx-indexer, Gnockpit, explorer) known for the
active network.
