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
- `docs/superpowers/plans/2026-07-22-slice-1-boot-experience.md` — the implementation
  plan this slice was built from.
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
