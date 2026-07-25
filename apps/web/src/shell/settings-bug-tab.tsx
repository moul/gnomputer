import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSdk } from "../sdk-context";
import { useWindowStore } from "./window-store";
import {
  generalBugReportUrl,
  buildBugReportBody,
  type BugReportShare,
  DEFAULT_BUG_REPORT_SHARE,
} from "./bug-report";

const SHARE_LABELS: { key: keyof BugReportShare; label: string }[] = [
  { key: "url", label: "Share current URL" },
  { key: "network", label: "Share active network" },
  { key: "build", label: "Share build/version info" },
  { key: "userAgent", label: "Share browser/user agent" },
  { key: "trail", label: "Share current Trail" },
  { key: "windowSetup", label: "Share current window setup" },
];

const TRAIL_STEPS_SHOWN = 5;

export function SettingsBugTab() {
  const sdk = useSdk();
  const [description, setDescription] = useState("");
  const [share, setShare] = useState<BugReportShare>(DEFAULT_BUG_REPORT_SHARE);
  const windows = useWindowStore((s) => s.windows);

  const { data: trailSummary } = useQuery({
    queryKey: ["bug-report-trail-summary"],
    queryFn: async () => {
      const trailId = await sdk.trails.getActiveTrailId();
      if (!trailId) return undefined;
      const steps = await sdk.trails.getSteps(trailId);
      if (steps.length === 0) return undefined;
      const shown = steps.slice(-TRAIL_STEPS_SHOWN).map((s) => s.label);
      const prefix = steps.length > TRAIL_STEPS_SHOWN ? "… → " : "";
      return prefix + shown.join(" → ");
    },
  });

  const openWindows = Object.values(windows).filter((w) => !w.closed);
  const windowSetupSummary =
    openWindows.length === 0
      ? "(no windows open)"
      : openWindows.map((w) => `${w.title} (${Math.round(w.width)}×${Math.round(w.height)})`).join(", ");

  function toggle(key: keyof BugReportShare) {
    setShare((s) => ({ ...s, [key]: !s[key] }));
  }

  const context = { trailSummary, windowSetupSummary };
  const previewBody = buildBugReportBody(description, share, context, sdk);

  return (
    <div className="settings-tab settings-bug-tab">
      <p className="settings-section-label">What happened?</p>
      <textarea
        className="settings-bug-tab__description"
        rows={4}
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
      <p className="settings-section-label">Preview</p>
      <pre className="settings-bug-tab__preview">{previewBody}</pre>
      <a
        className="settings-bug-tab__submit"
        href={generalBugReportUrl(sdk, description, share, context)}
        target="_blank"
        rel="noopener noreferrer"
      >
        Open issue on GitHub ↗
      </a>
    </div>
  );
}
