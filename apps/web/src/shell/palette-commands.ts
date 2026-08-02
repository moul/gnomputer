import { THEME_LABELS, THEME_ORDER, useThemeStore } from "./theme-store";
import { useZoomStore } from "./zoom-store";
import { useWindowStore } from "./window-store";
import { openSettings } from "./open-settings";
import { copyText } from "./copy-text";
import type { NetworkConfig } from "@gnomputer/app-sdk";

export interface PaletteCommand {
  id: string;
  /** What the user reads and types against. */
  label: string;
  /** Shown dimmed beside the label — the consequence, not a restatement. */
  hint?: string;
  /** Words that should find this command but do not appear in its label.
   * "dark" should reach the dark themes; "appearance" should reach the
   * theme settings even though the tab is called Theme. */
  keywords?: string[];
  run: () => void;
}

/** Commands the palette can run, as opposed to things it can look up.
 *
 * AUD-046: the README said unopened apps and actions live behind the
 * palette. Apps arrived first, then favorites (#171), and this is the rest
 * — the things you would otherwise have to go find a menu for. Everything
 * here is reversible and none of it touches the chain; a palette is a
 * fast path, not a place to put destructive actions where a stray Enter
 * can reach them.
 *
 * Networks are passed in rather than read from a store because switching
 * one needs both the SDK config and the shell store updated together, and
 * only the caller has the SDK. */
export function buildCommands(options: {
  networks: NetworkConfig[];
  activeNetworkId: string;
  setNetwork: (config: NetworkConfig) => void;
  /** How many windows are open. Overview deliberately refuses to engage
   * below two (window-store.ts: one tile is not an overview), so offering
   * it below two is offering an action that cannot act — the precise
   * failure this palette's tests assert against elsewhere. */
  openWindowCount: number;
}): PaletteCommand[] {
  const commands: PaletteCommand[] = [];

  for (const theme of THEME_ORDER) {
    commands.push({
      id: `theme:${theme}`,
      label: `Theme: ${THEME_LABELS[theme]}`,
      keywords: ["appearance", "colour", "color", ...THEME_LABELS[theme].toLowerCase().split(/[^a-z]+/)],
      run: () => useThemeStore.getState().setTheme(theme),
    });
  }

  for (const network of options.networks) {
    if (network.id === options.activeNetworkId) continue;
    commands.push({
      id: `network:${network.id}`,
      label: `Network: ${network.name}`,
      hint: network.chainId,
      keywords: ["chain", "switch", "rpc", network.id],
      run: () => options.setNetwork(network),
    });
  }

  commands.push(
    {
      id: "share:link",
      label: "Copy link to this view",
      hint: "Carries realm, lens and network",
      keywords: ["share", "url", "clipboard", "permalink"],
      run: () => {
        void copyText(window.location.href);
      },
    },
    {
      id: "zoom:in",
      label: "Zoom in",
      keywords: ["bigger", "larger", "scale"],
      run: () => useZoomStore.getState().zoomIn(),
    },
    {
      id: "zoom:out",
      label: "Zoom out",
      keywords: ["smaller", "scale"],
      run: () => useZoomStore.getState().zoomOut(),
    },
    {
      id: "zoom:reset",
      label: "Reset zoom",
      keywords: ["100%", "actual size"],
      run: () => useZoomStore.getState().resetZoom(),
    },
    {
      id: "settings:network",
      label: "Settings: Network",
      keywords: ["rpc", "endpoint", "custom", "chain"],
      run: () => openSettings("network"),
    },
    {
      id: "settings:theme",
      label: "Settings: Theme",
      keywords: ["appearance", "colour", "color"],
      run: () => openSettings("theme"),
    },
    {
      id: "settings:about",
      label: "Settings: About",
      keywords: ["version", "build"],
      run: () => openSettings("about"),
    },
    {
      id: "settings:changelog",
      label: "Settings: Changelog",
      keywords: ["what's new", "release"],
      run: () => openSettings("changelog"),
    },
    {
      id: "settings:bug",
      label: "Report a bug",
      keywords: ["issue", "feedback", "broken"],
      run: () => openSettings("bug"),
    }
  );

  if (options.openWindowCount >= 2) {
    commands.push({
      id: "windows:overview",
      label: "Show all windows",
      hint: "Overview",
      keywords: ["overview", "expose", "grid", "mission control"],
      run: () => useWindowStore.getState().toggleOverview(),
    });
  }

  return commands;
}

/** Commands matching a palette query, best first.
 *
 * Label hits outrank keyword hits: keywords exist so "appearance" can find
 * the Theme settings, not so a keyword collision can outrank something the
 * user typed the actual name of. */
export function matchCommands(
  query: string,
  commands: PaletteCommand[],
  limit = 5
): PaletteCommand[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return [];

  const scored: { command: PaletteCommand; rank: number }[] = [];
  for (const command of commands) {
    const label = command.label.toLowerCase();
    if (label === needle) scored.push({ command, rank: 0 });
    else if (label.startsWith(needle)) scored.push({ command, rank: 1 });
    else if (label.includes(needle)) scored.push({ command, rank: 2 });
    else if (command.keywords?.some((k) => k.startsWith(needle))) scored.push({ command, rank: 3 });
    else if (command.keywords?.some((k) => k.includes(needle))) scored.push({ command, rank: 4 });
  }

  return scored
    .sort((a, b) => a.rank - b.rank || a.command.label.localeCompare(b.command.label))
    .slice(0, limit)
    .map((s) => s.command);
}
