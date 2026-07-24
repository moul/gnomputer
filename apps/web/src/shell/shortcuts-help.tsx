import { useEffect } from "react";
import { useShellStore } from "../store";

const SHORTCUTS: { keys: string; description: string }[] = [
  { keys: "⌘K / Ctrl+K", description: "Open the command palette" },
  { keys: "⌘/ or ?", description: "Show this shortcuts help" },
  { keys: "Esc", description: "Close the command palette or this help" },
  { keys: "Click desktop background", description: "Toggle overview mode (see every open window)" },
];

export function ShortcutsHelp() {
  const shortcutsHelpOpen = useShellStore((s) => s.shortcutsHelpOpen);
  const setShortcutsHelpOpen = useShellStore((s) => s.setShortcutsHelpOpen);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isSlashToggle = (e.metaKey || e.ctrlKey) && e.key === "/";
      const isBareQuestionMark = e.key === "?" && !e.metaKey && !e.ctrlKey;
      if (isSlashToggle || isBareQuestionMark) {
        e.preventDefault();
        setShortcutsHelpOpen(!shortcutsHelpOpen);
      }
      if (e.key === "Escape") setShortcutsHelpOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [shortcutsHelpOpen, setShortcutsHelpOpen]);

  if (!shortcutsHelpOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      className="shortcuts-help"
      onClick={(e) => {
        if (e.target === e.currentTarget) setShortcutsHelpOpen(false);
      }}
    >
      <div className="shortcuts-help__panel">
        <p className="shortcuts-help__title">Keyboard shortcuts</p>
        <dl className="shortcuts-help__list">
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className="shortcuts-help__row">
              <dt>{s.keys}</dt>
              <dd>{s.description}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
