# ADR-014: Windowed desktop shell for Home

## Context

The original Slice 1 design (§14.1 of the spec) deliberately avoided a free-form desktop
window manager, favoring tabbed views and split panes first. Per direct user request
during implementation ("I really want a computer interface with windowed content"), that
default was overridden for Home specifically: realm/source/activity/monitoring content
should be real, independently movable and resizable windows, not fixed split panes.

## Decision

Added a small, dependency-free window manager (`apps/web/src/shell/window-store.ts` +
`window.tsx`): a Zustand store tracking `{x, y, width, height, zIndex, title, closed}`
per window id, and a `<Window>` component handling drag (via pointer events on the
titlebar), resize (via a corner handle), close, and focus-to-front. A `<WindowDock>`
lists closed windows so they can be reopened.

Window geometry persists across reloads via a new generic `sdk.uiState` key/value API
(`packages/app-sdk`), which reuses the existing Dexie `meta` table under a `uiState:`
key prefix — chosen over adding a dedicated Dexie table because the data is a single
opaque JSON blob per page, not something that needs querying.

Visual language is deliberately more expressive than the rest of the app (per explicit
follow-up user direction: bold, colorful, "ASCII-art window manager" chrome) — sharp
corners, box-drawing corner brackets, monospace uppercase titlebars, per-window accent
colors. This is a conscious exception to the calmer, more restrained treatment used for
page content (prose, source code, tables) elsewhere in the app; the window *chrome* is
allowed to have personality precisely because it's chrome, not the content itself.

## Consequences

A fixed-position, absolutely-positioned window canvas does not adapt to narrow
viewports the way a real desktop OS's window manager doesn't either — `.desktop`
contains its own horizontal scroll (`overflow-x: auto`) rather than letting oversized
windows blow out the page's layout on mobile, but the windowing UX itself is
effectively a wide-viewport feature. World and Account remain plain single-panel pages
for now rather than being folded into the windowed desktop; if more of the app moves to
windows, revisit whether every app should render inside `<Window>` uniformly instead of
Home being a special case.
