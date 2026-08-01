import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSdk } from "../sdk-context";
import { CodeEditor } from "../shell/code-editor-lazy";
import { GNO_TEMPLATES, type GnoTemplate } from "../gno-templates";
import { ErrorState } from "../shell/error-state";
import { useEditorSignalStore } from "../shell/editor-store";

const AUTOSAVE_DELAY_MS = 600;

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

const SAVE_LABEL: Record<SaveState, string> = {
  idle: "",
  dirty: "Unsaved changes",
  saving: "Saving…",
  saved: "Saved",
  error: "Not saved",
};

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

  // A fork (or any future "open this script" entry point) sets this from
  // outside the Editor window — pick it up as soon as the script it points
  // to has actually loaded, overriding whatever was active before.
  const pendingScriptId = useEditorSignalStore((s) => s.pendingScriptId);
  const takePendingScriptId = useEditorSignalStore((s) => s.takePendingScriptId);
  useEffect(() => {
    if (pendingScriptId === null || !scripts) return;
    if (!scripts.some((s) => s.id === pendingScriptId)) return;
    setActiveId(takePendingScriptId());
    setShowTemplates(false);
  }, [pendingScriptId, scripts, takePendingScriptId]);

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

  // Autosave. The previous version cleared its debounce timer on cleanup,
  // and since `draftCode` is a dependency that cleanup ran on every
  // keystroke — which is correct for debouncing, but it also meant that
  // switching scripts, closing the window, or an update-refresh inside the
  // 600ms window silently threw away the newest edits. It also ignored
  // rejected writes and surfaced no state at all, so the user had no way to
  // know whether their work was safe.
  //
  // `pendingRef` holds the newest unsaved edit so it can be flushed from any
  // of those exit paths instead of dropped.
  const pendingRef = useRef<{ id: string; code: string } | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  const flush = useCallback(async () => {
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    setSaveState("saving");
    try {
      await sdk.scripts.update(pending.id, { code: pending.code });
      await refetch();
      setSaveState("saved");
      setSaveError(null);
    } catch (e) {
      // Put it back so a later flush (or retry) can still save it, and say
      // so — a failed write used to vanish silently.
      pendingRef.current = pending;
      setSaveState("error");
      setSaveError(e instanceof Error ? e.message : String(e));
    }
  }, [sdk, refetch]);

  // Kept in a ref so the exit-path effects below don't re-run (and therefore
  // don't flush) just because `flush` was re-created.
  const flushRef = useRef(flush);
  flushRef.current = flush;

  useEffect(() => {
    if (!active || draftCode === active.code) return;
    pendingRef.current = { id: active.id, code: draftCode };
    setSaveState("dirty");
    const timer = window.setTimeout(() => void flushRef.current(), AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [draftCode, active]);

  // Switching scripts or unmounting: flush rather than drop. Deliberately
  // keyed on the script id alone, so this cleanup does NOT run per keystroke
  // (which would defeat the debounce entirely).
  useEffect(() => {
    return () => {
      void flushRef.current();
    };
  }, [active?.id]);

  // Tab hidden / navigating away / the update banner reloading. An async
  // IndexedDB write isn't guaranteed to finish during unload, but attempting
  // it is strictly better than the previous behaviour of discarding it.
  useEffect(() => {
    function onHide() {
      if (document.visibilityState === "hidden") void flushRef.current();
    }
    function onPageHide() {
      void flushRef.current();
    }
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        // Stop the browser's own "save page" dialog — in an editor, Cmd+S
        // should mean save the script.
        e.preventDefault();
        void flushRef.current();
      }
    }
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

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

  async function duplicateActive() {
    if (!active) return;
    const record = await sdk.scripts.create(`${active.name} (copy)`, active.code);
    await refetch();
    setActiveId(record.id);
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
              <button type="button" onClick={() => void duplicateActive()}>
                Duplicate
              </button>
              <button type="button" onClick={() => void deleteActive()}>
                Delete
              </button>
              {saveState !== "idle" && (
                <span
                  className="editor-window__save-state"
                  data-state={saveState}
                  role={saveState === "error" ? "alert" : "status"}
                  title={saveError ?? undefined}
                >
                  {SAVE_LABEL[saveState]}
                  {saveState === "error" && saveError ? `: ${saveError}` : ""}
                </span>
              )}
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
