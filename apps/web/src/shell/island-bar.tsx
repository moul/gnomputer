import { useWindowStore } from "./window-store";
import { useRealmTabsStore } from "./realm-tabs-store";
import { APP_REGISTRY, ISLAND_GROUPS } from "./app-registry";
import { focusFamilyOrOpenDefault, realmFamilyIds } from "./focus-family";
import { openSettings } from "./open-settings";
import { IslandPopover } from "./island-popover";
import { IslandSettingsMenu } from "./island-settings-menu";
import { IslandProfileMenu } from "./island-profile-menu";
import { IslandChainMenu } from "./island-chain-menu";
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
  const restore = useWindowStore((s) => s.restore);
  const reopen = useWindowStore((s) => s.reopen);
  const overviewOpen = useWindowStore((s) => s.overviewOpen);
  const closeOverview = useWindowStore((s) => s.closeOverview);
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
        restore,
        reopen,
      });
      scrollToWindow(focusedId);
      return;
    }
    const focusedId = focusFamilyOrOpenDefault(icon.memberIds, icon.defaultId, windows, {
      focus,
      restore,
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

  const settingsOpen = windows["settings"] !== undefined && !windows["settings"]!.closed;

  // While overview mode is active, the island isn't really usable as a menu
  // (see IslandPopover's disabled prop) — replacing its whole content with
  // the mode's own hint is clearer than a dimmed icon row plus a separate
  // hint pill fighting for the same space (the earlier approach was hard to
  // read against the dimmed-but-still-visible icons behind it). Any click
  // here just exits overview, same as clicking the desktop background.
  if (overviewOpen) {
    return (
      <button
        type="button"
        className="island island--overview"
        onClick={() => closeOverview()}
      >
        Overview · click a window to open it
      </button>
    );
  }

  return (
    <div className="island" role="toolbar" aria-label="Apps">
      <span className="island__brand" aria-hidden="true">
        ⌘
      </span>
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
      {ISLAND_ICONS.map((icon) => {
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
        if (icon.key === "settings") {
          return (
            <IslandPopover key={icon.key} trigger={trigger}>
              <IslandSettingsMenu />
            </IslandPopover>
          );
        }
        if (icon.key === "chain") {
          return (
            <IslandPopover key={icon.key} trigger={trigger}>
              <IslandChainMenu />
            </IslandPopover>
          );
        }
        return <span key={icon.key}>{trigger}</span>;
      })}
      <IslandPopover
        trigger={
          <button
            type="button"
            className="island__icon"
            data-open={settingsOpen}
            title="Profile"
            aria-label="Profile"
            onClick={() => openSettings("user")}
            onMouseEnter={() => setHoveredWindowIds(["settings"])}
            onMouseLeave={() => setHoveredWindowIds([])}
          >
            👤
            {settingsOpen && <span className="island__icon-dot" aria-hidden="true" />}
          </button>
        }
      >
        <IslandProfileMenu />
      </IslandPopover>
      <span className="island__divider" aria-hidden="true" />
      <IslandClock disabled={overviewOpen} />
    </div>
  );
}
