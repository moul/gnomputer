# Changelog

Notable user-facing changes to Gnomputer, most recent first. Dated by when
they landed on `main`, not by PR number. The in-app "new version available"
banner links here.

## 2026-07-24

- Added a "new version available" banner that properly waits for the new
  service worker to take control before reloading, instead of a plain
  reload that could silently still show the old version.
- Custom networks: add your own RPC endpoint from Settings → Network,
  switch to it immediately, and it persists across reloads.
- Embed mygnoscan and Gnockpit inline via an "Embed here" button next to
  their existing external links, instead of only opening in a new tab.
- Added a general "Report a bug" button (island Settings menu, Settings →
  About) that pre-fills a GitHub issue with build/network context — not
  just available after an actual crash.
- Omnisearch (⌘K) now resolves both `@username` and a bare `username` to
  an address via `r/sys/users.ResolveAny`, landing directly on the
  resolved Accounts window.
- Users app shows a "Recently looked up" list, sourced from your own
  Trail (there's no chain-side way to list *everyone's* recent activity —
  chain events carry no signer address).
- Two new themes: Cypherpunk (green-phosphor terminal, scanline texture)
  and Minimal (flattened chrome, no shadows/colored accents) — each with
  genuinely distinct chrome, not just a recolored ASCII/Clean theme.
- Markdown now renders properly in Resources (docs/ and awesome-gno), with
  full folder navigation for the Gno monorepo's own `docs/`.
- Real syntax highlighting in the Source lens; a new Editor app to write,
  save, and run Gno scripts locally, with community-contributed templates.
- Keyboard shortcuts help (`⌘/` or `?`); hovering the Browser icon lists
  every open Browser window (it supports several at once via pop-out).
- Fixed: overview/expose mode no longer bounces back to the grid a beat
  after clicking a window; a real (if rare) bug where a long session's
  window focus churn could let a window's stacking order climb high
  enough to paint over the island bar's own popovers.
- Removed: the taskbar minimize button (and the dead state behind it),
  the "gno.land official pages" shortcut list (not consistently deployed
  across networks), the redundant account-lookup form in Settings → User.

## Earlier

Everything before this point — the guest-mode read-only PWA itself, the
windowed desktop shell, Trails, the Realm Browser/Source/State/History/
Actions/Graph/Raw lenses, Network/Validator/Block/Event monitoring,
Gnockpit, Users — shipped without a changelog. See `git log` for the full
history; `docs/adr/` for the architectural decisions behind it.
