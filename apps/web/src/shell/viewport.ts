// Shared with the status bar's narrow-screen layout (styles/shell.css), the
// zoom store's mobile default, and windows' mobile-maximized default — one
// breakpoint definition so they can't drift out of sync with each other.
export const MOBILE_WIDTH_BREAKPOINT = 700;

export function isMobileViewport(): boolean {
  return typeof window !== "undefined" && window.innerWidth <= MOBILE_WIDTH_BREAKPOINT;
}
