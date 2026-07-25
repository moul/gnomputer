import type { GnomputerSDK } from "@gnomputer/app-sdk";

/** Which context lines to attach to a general bug report — the Settings
 * "Report a bug" tab shows one checkbox per field, all checked by default,
 * so the reporter can drop anything they'd rather not share. Trail and
 * windowSetup need data the caller fetches/reads itself (see
 * BugReportContext) since bug-report.ts has no access to the Trail DB or
 * the window store on its own. */
export interface BugReportShare {
  url: boolean;
  network: boolean;
  build: boolean;
  userAgent: boolean;
  trail: boolean;
  windowSetup: boolean;
}

export const DEFAULT_BUG_REPORT_SHARE: BugReportShare = {
  url: true,
  network: true,
  build: true,
  userAgent: true,
  trail: true,
  windowSetup: true,
};

/** Precomputed summaries the caller supplies — trail steps come from
 * sdk.trails (async), window setup from the window store (sync but still
 * the caller's own state, not something bug-report.ts should reach into
 * directly). Missing/undefined just means that line is omitted, same as
 * the field being unchecked. */
export interface BugReportContext {
  trailSummary?: string;
  windowSetupSummary?: string;
}

function issueUrl(title: string, body: string): string {
  const params = new URLSearchParams({
    title: title.slice(0, 200),
    body,
    labels: "bug",
  });
  return `${__GIT_REPO__}/issues/new?${params.toString()}`;
}

export function crashReportUrl(error: Error): string {
  const body = [
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
  ].join("\n");
  return issueUrl(`Crash: ${error.message || "Unknown error"}`, body);
}

/** The exact markdown body a general bug report will submit — pulled out
 * of generalBugReportUrl so the Settings "Report a bug" tab can render it
 * as a live preview (updating with every checkbox/textarea change) instead
 * of only being visible after actually opening the GitHub issue. */
export function buildBugReportBody(
  description: string,
  share: BugReportShare,
  context: BugReportContext = {},
  sdk?: GnomputerSDK,
): string {
  const network = sdk?.networks.getActive();
  const contextLines = [
    share.url && `- URL: ${window.location.href}`,
    share.build && `- Build: ${__GIT_HASH__} (${__BUILD_TIME__})`,
    share.network && network && `- Network: ${network.name} (${network.id})`,
    share.userAgent && `- User agent: ${navigator.userAgent}`,
    share.trail && context.trailSummary && `- Trail: ${context.trailSummary}`,
    share.windowSetup && context.windowSetupSummary && `- Windows: ${context.windowSetupSummary}`,
  ].filter((line): line is string => typeof line === "string");

  const sections = ["**What happened?**", "", description.trim() || "_(fill in)_"];
  if (contextLines.length > 0) sections.push("", "**Context**", ...contextLines);
  return sections.join("\n");
}

/** For the general "Report a bug" Settings tab — no error/stack trace to
 * attach (nothing necessarily crashed), just whatever context the reporter
 * opted into sharing (see BugReportShare) plus their own description. */
export function generalBugReportUrl(
  sdk: GnomputerSDK,
  description = "",
  share: BugReportShare = DEFAULT_BUG_REPORT_SHARE,
  context: BugReportContext = {},
): string {
  return issueUrl("Bug: ", buildBugReportBody(description, share, context, sdk));
}
