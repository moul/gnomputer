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

Everything below is real, live data from the official Gno testnet (Test13) — no mocked
or fabricated content in the running app:

- **Experience** — a realm's rendered output, with Gno's own internal link/pagination
  routing followed generically (works for any realm, e.g. GovDAO's 49+ real proposals).
- **Source** — a realm's file tree and source, fetched directly from the chain.
- **Recent activity** — polls block headers live; shows height, real transaction
  counts, and time. No transaction-content decoding yet (see ADR-013).
- **Network Monitor** — chain ID, live height, measured RPC latency, endpoint trust.
- **Validator Monitor** — the full live validator set: address, voting power, proposer
  priority.
- **Block Explorer** — look up any block by height; full header detail including
  proposer and data/validator hashes.
- **Account** (`/account`) and **World** (`/world`) — balance/account lookup by
  address, and a favorites list.

Windows are draggable, resizable, closable (reopen from the dock that appears), and
their layout persists across reloads.

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
