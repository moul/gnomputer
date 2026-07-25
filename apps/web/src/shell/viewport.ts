// Shared with the zoom store's mobile default — one breakpoint definition
// so it can't drift out of sync with itself.
export const MOBILE_WIDTH_BREAKPOINT = 700;

export function isMobileViewport(): boolean {
  return typeof window !== "undefined" && window.innerWidth <= MOBILE_WIDTH_BREAKPOINT;
}

// Deliberately narrower than MOBILE_WIDTH_BREAKPOINT and used only for
// "start this window maximized" — a plain narrow desktop browser window
// (e.g. tiled next to another app) is common well under 700px and
// shouldn't force every new window to fullscreen the way an actual phone
// screen should.
export const PHONE_WIDTH_BREAKPOINT = 480;

export function isPhoneViewport(): boolean {
  return typeof window !== "undefined" && window.innerWidth <= PHONE_WIDTH_BREAKPOINT;
}

// The island bar (island-bar.tsx) is fixed at top:12px with roughly 32-36px
// of its own height — windows and the maximize/overview layouts all need
// to clear it by at least this much. Also mirrored as --island-clearance in
// theme.css so CSS (which can't import this) stays in sync.
export const ISLAND_CLEARANCE_PX = 56;

// .window__titlebar's own rendered height (padding + line-height, see
// shell.css) — window-store.ts's drag/reclamp bounds use this so a
// window's titlebar can never be dragged (or left behind after a browser
// resize) past the bottom edge of the viewport, where it'd be ungrabbable.
export const TITLEBAR_HEIGHT_PX = 36;
