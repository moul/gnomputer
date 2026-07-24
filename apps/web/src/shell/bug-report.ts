import type { GnomputerSDK } from "@gnomputer/app-sdk";

/** Which context lines to attach to a general bug report — the Settings
 * "Report a bug" tab shows one checkbox per field, all checked by default,
 * so the reporter can drop anything they'd rather not share. */
export interface BugReportShare {
  url: boolean;
  network: boolean;
  build: boolean;
  userAgent: boolean;
}

export const DEFAULT_BUG_REPORT_SHARE: BugReportShare = {
  url: true,
  network: true,
  build: true,
  userAgent: true,
};

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

/** For the general "Report a bug" Settings tab — no error/stack trace to
 * attach (nothing necessarily crashed), just whatever context the reporter
 * opted into sharing (see BugReportShare) plus their own description. */
export function generalBugReportUrl(
  sdk: GnomputerSDK,
  description = "",
  share: BugReportShare = DEFAULT_BUG_REPORT_SHARE,
): string {
  const network = sdk.networks.getActive();
  const contextLines = [
    share.url && `- URL: ${window.location.href}`,
    share.build && `- Build: ${__GIT_HASH__} (${__BUILD_TIME__})`,
    share.network && `- Network: ${network.name} (${network.id})`,
    share.userAgent && `- User agent: ${navigator.userAgent}`,
  ].filter((line): line is string => line !== false);

  const sections = ["**What happened?**", "", description.trim() || "_(fill in)_"];
  if (contextLines.length > 0) sections.push("", "**Context**", ...contextLines);

  return issueUrl("Bug: ", sections);
}
