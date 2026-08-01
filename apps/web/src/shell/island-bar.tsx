import { useWindowStore } from "./window-store";
import { useRealmTabsStore } from "./realm-tabs-store";
import { APP_REGISTRY, ISLAND_GROUPS } from "./app-registry";
import { focusFamilyOrOpenDefault, realmFamilyIds } from "./focus-family";
import { IslandPopover } from "./island-popover";
import { IslandStatus } from "./island-status";
import { IslandSettingsMenu } from "./island-settings-menu";
import { IslandChainMenu } from "./island-chain-menu";
import { IslandBrowserMenu } from "./island-browser-menu";
import { IslandEditorMenu } from "./island-editor-menu";
import { IslandDiscoverMenu, DISCOVER_WINDOW_IDS } from "./island-discover-menu";
import { IslandClock } from "./island-clock";
import { useShellStore } from "../store";

// One entry per island icon — apps sharing a `group` (app-registry.ts)
// collapse into a single icon here, so 11 registered apps read as ~7
// distinct island slots.
interface IslandIcon {
  key: string;
  label: string;
  icon: string;
  memberIds: string[];
  defaultId: string;
  supportsMultiWindow: boolean;
}

function buildIslandIcons(): IslandIcon[] {
  const seenGroups = new Set<string>();
  const icons: IslandIcon[] = [];
  for (const app of APP_REGISTRY) {
    if (app.hiddenFromIsland) continue;
    if (app.group) {
      if (seenGroups.has(app.group)) continue;
      seenGroups.add(app.group);
      const group = ISLAND_GROUPS[app.group]!;
      const memberIds = APP_REGISTRY.filter((a) => a.group === app.group).map((a) => a.id);
      icons.push({
        key: app.group,
        label: group.label,
        icon: group.icon,
        memberIds,
        defaultId: group.defaultId,
        supportsMultiWindow: false,
      });
    } else {
      icons.push({
        key: app.id,
        label: app.label,
        icon: app.icon,
        memberIds: [app.id],
        defaultId: app.id,
        supportsMultiWindow: app.supportsMultiWindow,
      });
    }
  }
  return icons;
}

const ISLAND_ICONS = buildIslandIcons();

export function IslandBar() {
  const windows = useWindowStore((s) => s.windows);
  const focus = useWindowStore((s) => s.focus);
  const reopen = useWindowStore((s) => s.reopen);
  const overviewOpen = useWindowStore((s) => s.overviewOpen);
  const closeOverview = useWindowStore((s) => s.closeOverview);
  const closeAllWindows = useWindowStore((s) => s.closeAll);
  const createNewRealmWindow = useRealmTabsStore((s) => s.createNewWindow);
  const setCommandPaletteOpen = useShellStore((s) => s.setCommandPaletteOpen);
  const setHoveredWindowIds = useShellStore((s) => s.setHoveredWindowIds);

  function scrollToWindow(id: string) {
    document
      .getElementById(`window-${id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }

  function openIcon(icon: IslandIcon) {
    if (icon.supportsMultiWindow) {
      const familyIds = realmFamilyIds(windows);
      const anyOpen = familyIds.some((id) => windows[id] && !windows[id]!.closed);
      if (!anyOpen) {
        const newId = createNewRealmWindow();
        requestAnimationFrame(() => scrollToWindow(newId));
        return;
      }
      const focusedId = focusFamilyOrOpenDefault(familyIds, icon.defaultId, windows, {
        focus,
        reopen,
      });
      scrollToWindow(focusedId);
      return;
    }
    const focusedId = focusFamilyOrOpenDefault(icon.memberIds, icon.defaultId, windows, {
      focus,
      reopen,
    });
    scrollToWindow(focusedId);
  }

  function isOpen(icon: IslandIcon): boolean {
    if (icon.supportsMultiWindow) {
      return realmFamilyIds(windows).some((id) => windows[id] && !windows[id]!.closed);
    }
    return icon.memberIds.some((id) => windows[id] && !windows[id]!.closed);
  }

  function hoverIds(icon: IslandIcon): string[] {
    return icon.supportsMultiWindow ? realmFamilyIds(windows) : icon.memberIds;
  }

  // While overview mode is active, the island isn't really usable as a menu
  // (see IslandPopover's disabled prop) — replacing its whole content with
  // the mode's own hint is clearer than a dimmed icon row plus a separate
  // hint pill fighting for the same space (the earlier approach was hard to
  // read against the dimmed-but-still-visible icons behind it). Any click
  // here just exits overview, same as clicking the desktop background.
  if (overviewOpen) {
    return (
      <div className="island island--overview">
        <button type="button" className="island__overview-hint" onClick={() => closeOverview()}>
          Overview · click a window to open it
        </button>
        <button
          type="button"
          className="island__overview-close-all"
          onClick={() => {
            closeAllWindows();
            closeOverview();
          }}
        >
          Close all windows
        </button>
      </div>
    );
  }

  return (
    <div className="island" role="toolbar" aria-label="Apps">
      {/* The app never said its own name anywhere on screen. In a browser
          tab the title carries it; installed as a PWA there is no tab
          (AUD-011). Dim and small — identification, not branding. */}
      <span className="island__wordmark" aria-hidden="true">
        gnomputer
      </span>
      <span className="island__divider" aria-hidden="true" />
      <button
        type="button"
        className="island__icon"
        aria-label="Open command palette (Cmd+K)"
        title="Search (⌘K)"
        onClick={() => setCommandPaletteOpen(true)}
      >
        🔍
      </button>
      <span className="island__divider" aria-hidden="true" />
      {ISLAND_ICONS.flatMap((icon) => {
        const trigger = (
          <button
            type="button"
            className="island__icon"
            data-open={isOpen(icon)}
            title={icon.label}
            aria-label={icon.label}
            onClick={() => openIcon(icon)}
            onMouseEnter={() => setHoveredWindowIds(hoverIds(icon))}
            onMouseLeave={() => setHoveredWindowIds([])}
          >
            {icon.icon}
            {isOpen(icon) && <span className="island__icon-dot" aria-hidden="true" />}
          </button>
        );
        let rendered: JSX.Element;
        if (icon.key === "settings") {
          rendered = (
            <IslandPopover key={icon.key} trigger={trigger}>
              <IslandSettingsMenu />
            </IslandPopover>
          );
        } else if (icon.key === "chain") {
          rendered = (
            <IslandPopover key={icon.key} trigger={trigger}>
              <IslandChainMenu />
            </IslandPopover>
          );
        } else if (icon.key === "editor") {
          rendered = (
            <IslandPopover key={icon.key} trigger={trigger}>
              <IslandEditorMenu />
            </IslandPopover>
          );
        } else if (
          // The Browser icon can have several windows open at once (pop out
          // a tab) — a click only ever reaches whichever was focused most
          // recently, so hovering lists every open one (title included)
          // once there's at least one to show. Zero open windows has
          // nothing to list, so it stays a plain click-to-open.
          icon.key === "realm" &&
          realmFamilyIds(windows).some((id) => windows[id] && !windows[id]!.closed)
        ) {
          rendered = (
            <IslandPopover key={icon.key} trigger={trigger}>
              <IslandBrowserMenu />
            </IslandPopover>
          );
        } else {
          rendered = <span key={icon.key}>{trigger}</span>;
        }

        // Discover isn't a real app/window of its own (see app-registry.ts)
        // — it's a hover-only dropdown listing five genuinely independent
        // apps, with no click behavior, since there's no single underlying
        // window left to focus-or-open (unlike every other grouped icon
        // here). Spliced in right after Browser, matching where "discover"
        // used to sit in the app registry before the split.
        if (icon.key === "realm") {
          const discoverOpen = DISCOVER_WINDOW_IDS.some((id) => windows[id] && !windows[id]!.closed);
          // A real <button>, not a <div>: as a div it was not focusable at
          // all, so the entire Discover menu (Users/Packages/Transactions/
          // Tokens/Governance) was unreachable by keyboard, and on touch it
          // had no tap target either. It still has no click *action* of its
          // own — IslandPopover attaches tap-to-toggle.
          const discoverTrigger = (
            <button
              type="button"
              className="island__icon"
              data-open={discoverOpen}
              title="Discover"
              aria-label="Discover"
              onMouseEnter={() => setHoveredWindowIds(DISCOVER_WINDOW_IDS)}
              onMouseLeave={() => setHoveredWindowIds([])}
            >
              🔭
              {discoverOpen && <span className="island__icon-dot" aria-hidden="true" />}
            </button>
          );
          return [
            rendered,
            <IslandPopover key="discover" trigger={discoverTrigger}>
              <IslandDiscoverMenu />
            </IslandPopover>,
          ];
        }
        return [rendered];
      })}
      <span className="island__divider" aria-hidden="true" />
      <IslandStatus />
      <IslandClock disabled={overviewOpen} />
    </div>
  );
}
