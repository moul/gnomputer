import { useState } from "react";
import { useSdk } from "../sdk-context";
import { generalBugReportUrl, type BugReportShare, DEFAULT_BUG_REPORT_SHARE } from "./bug-report";

const SHARE_LABELS: { key: keyof BugReportShare; label: string }[] = [
  { key: "url", label: "Share current URL" },
  { key: "network", label: "Share active network" },
  { key: "build", label: "Share build/version info" },
  { key: "userAgent", label: "Share browser/user agent" },
];

export function SettingsBugTab() {
  const sdk = useSdk();
  const [description, setDescription] = useState("");
  const [share, setShare] = useState<BugReportShare>(DEFAULT_BUG_REPORT_SHARE);

  function toggle(key: keyof BugReportShare) {
    setShare((s) => ({ ...s, [key]: !s[key] }));
  }

  return (
    <div className="settings-tab settings-bug-tab">
      <p className="settings-section-label">What happened?</p>
      <textarea
        className="settings-bug-tab__description"
        rows={5}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Describe what you were doing and what went wrong…"
      />
      <p className="settings-section-label">Include with the report</p>
      <div className="settings-bug-tab__checkboxes">
        {SHARE_LABELS.map(({ key, label }) => (
          <label key={key} className="settings-bug-tab__checkbox">
            <input type="checkbox" checked={share[key]} onChange={() => toggle(key)} />
            {label}
          </label>
        ))}
      </div>
      <a
        className="settings-bug-tab__submit"
        href={generalBugReportUrl(sdk, description, share)}
        target="_blank"
        rel="noopener noreferrer"
      >
        Open issue on GitHub ↗
      </a>
    </div>
  );
}
