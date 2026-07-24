import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSdk } from "../sdk-context";
import { CodeEditor } from "../shell/code-editor-lazy";
import { GNO_TEMPLATES, type GnoTemplate } from "../gno-templates";
import { ErrorState } from "../shell/error-state";

const AUTOSAVE_DELAY_MS = 600;

export function Editor() {
  const sdk = useSdk();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [draftCode, setDraftCode] = useState("");

  const {
    data: scripts,
    error,
    isPending,
    refetch,
  } = useQuery({
    queryKey: ["editor-scripts"],
    queryFn: () => sdk.scripts.list(),
  });

  useEffect(() => {
    if (activeId === null && scripts && scripts.length > 0) setActiveId(scripts[0]!.id);
  }, [scripts, activeId]);

  const active = scripts?.find((s) => s.id === activeId) ?? null;

  useEffect(() => {
    setDraftCode(active?.code ?? "");
    // Only reset the draft when which script is open changes, not every
    // time its code does — the code changes on every keystroke via
    // setDraftCode below, and re-syncing from `active.code` on every one of
    // those would just echo the same value right back (harmless) until the
    // autosave below updates it mid-typing, which would then clobber
    // whatever the user typed after that save fired.
  }, [active?.id]);

  useEffect(() => {
    if (!active || draftCode === active.code) return;
    const timer = window.setTimeout(() => {
      void sdk.scripts.update(active.id, { code: draftCode }).then(() => refetch());
    }, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [draftCode, active, sdk, refetch]);

  async function createScript(name: string, code: string) {
    const record = await sdk.scripts.create(name, code);
    await refetch();
    setActiveId(record.id);
    setShowTemplates(false);
  }

  async function renameActive() {
    if (!active) return;
    const name = window.prompt("Rename script", active.name);
    if (!name || !name.trim()) return;
    await sdk.scripts.update(active.id, { name: name.trim() });
    await refetch();
  }

  async function deleteActive() {
    if (!active) return;
    if (!window.confirm(`Delete "${active.name}"? This can't be undone.`)) return;
    await sdk.scripts.remove(active.id);
    setActiveId(null);
    await refetch();
  }

  if (error) {
    return (
      <ErrorState message={`Could not load your scripts: ${error.message}`} onRetry={() => void refetch()} />
    );
  }
  if (isPending || !scripts) {
    return (
      <p className="state-line" aria-busy="true">
        Loading scripts…
      </p>
    );
  }

  return (
    <div className="editor-window">
      <nav aria-label="Scripts" className="file-tree editor-window__sidebar">
        <ul>
          {scripts.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                aria-current={s.id === activeId}
                onClick={() => {
                  setActiveId(s.id);
                  setShowTemplates(false);
                }}
              >
                {s.name}
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="editor-window__new" onClick={() => setShowTemplates(true)}>
          + New script
        </button>
      </nav>
      <div className="editor-window__main">
        {showTemplates ? (
          <TemplatePicker
            onPick={(t) => void createScript(t.label, t.code)}
            onCancel={() => setShowTemplates(false)}
          />
        ) : active ? (
          <>
            <div className="editor-window__toolbar">
              <span className="editor-window__name">{active.name}</span>
              <button type="button" onClick={() => void renameActive()}>
                Rename
              </button>
              <button type="button" onClick={() => void deleteActive()}>
                Delete
              </button>
              <span className="editor-window__spacer" />
              <button type="button" disabled title="Wallet connection isn't available yet">
                Run…
              </button>
              <button type="button" disabled title="Wallet connection isn't available yet">
                Publish…
              </button>
            </div>
            <div className="editor-window__code">
              <CodeEditor key={active.id} value={draftCode} onChange={setDraftCode} />
            </div>
          </>
        ) : (
          <div className="editor-window__empty">
            <p className="state-line">No scripts yet — start from a template or a blank file.</p>
            <button type="button" onClick={() => setShowTemplates(true)}>
              + New script
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TemplatePicker({
  onPick,
  onCancel,
}: {
  onPick: (template: GnoTemplate) => void;
  onCancel: () => void;
}) {
  return (
    <div className="editor-window__templates">
      <p className="state-line">Start from a template:</p>
      <ul className="realm-browser-home__list">
        {GNO_TEMPLATES.map((t) => (
          <li key={t.label}>
            <button type="button" onClick={() => onPick(t)}>
              {t.label}
              <span className="realm-browser-home__path">{t.description}</span>
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={() => onPick({ label: "Untitled", description: "", code: "package main\n" })}
          >
            Blank file
            <span className="realm-browser-home__path">Start with nothing but a package declaration.</span>
          </button>
        </li>
      </ul>
      <button type="button" className="editor-window__templates-cancel" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
