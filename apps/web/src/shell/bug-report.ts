import type { GnomputerSDK } from "@gnomputer/app-sdk";

/** Shared "here's what we know" context block for a bug report — build
 * info, current URL, active network, user agent. Used both by a crash's
 * automatic report (app-error-fallback.tsx) and the general "Report a bug"
 * button, so both file issues a maintainer can actually act on without
 * asking "what version/network were you on?" first. */
function contextLines(sdk: GnomputerSDK): string[] {
  const network = sdk.networks.getActive();
  return [
    "**Context**",
    `- URL: ${window.location.href}`,
    `- Build: ${__GIT_HASH__} (${__BUILD_TIME__})`,
    `- Network: ${network.name} (${network.id})`,
    `- User agent: ${navigator.userAgent}`,
  ];
}

function issueUrl(title: string, sections: string[]): string {
  const params = new URLSearchParams({
    title: title.slice(0, 200),
    body: sections.join("\n"),
    labels: "bug",
  });
  return `${__GIT_REPO__}/issues/new?${params.toString()}`;
}

export function crashReportUrl(error: Error): string {
  return issueUrl(`Crash: ${error.message || "Unknown error"}`, [
    "**What were you doing when this happened?**",
    "",
    "_(fill in — helps reproduce it)_",
    "",
    "**Error**",
    "```",
    (error.stack || error.message || String(error)).slice(0, 4000),
    "```",
    "",
    `- URL: ${window.location.href}`,
    `- Build: ${__GIT_HASH__} (${__BUILD_TIME__})`,
    `- User agent: ${navigator.userAgent}`,
  ]);
}

/** For the general "Report a bug" button — no error/stack trace to attach
 * (nothing necessarily crashed), just the same build/network context plus
 * blank prompts for the user to fill in before submitting. */
export function generalBugReportUrl(sdk: GnomputerSDK): string {
  return issueUrl("Bug: ", [
    "**What happened?**",
    "",
    "_(fill in)_",
    "",
    "**What did you expect instead?**",
    "",
    "_(fill in)_",
    "",
    ...contextLines(sdk),
  ]);
}
