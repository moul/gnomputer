import { Markdown } from "./markdown-lazy";
import { CHANGELOG_TEXT } from "./changelog";

export function SettingsChangelogTab() {
  return (
    <div className="settings-tab settings-changelog-tab">
      <a
        className="settings-changelog-tab__source-link"
        href={`${__GIT_REPO__}/blob/main/CHANGELOG.md`}
        target="_blank"
        rel="noopener noreferrer"
      >
        View CHANGELOG.md on GitHub ↗
      </a>
      <div className="settings-changelog-tab__body">
        <Markdown text={CHANGELOG_TEXT} />
      </div>
    </div>
  );
}
