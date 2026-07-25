import { useEffect, useRef } from "react";
import { Decoration, EditorView } from "@codemirror/view";
import { EditorState, RangeSetBuilder, type Extension } from "@codemirror/state";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { basicSetup, minimalSetup } from "codemirror";
import { go } from "@codemirror/lang-go";
import { tags } from "@lezer/highlight";
import { findImportPaths } from "./find-import-paths";

// Colors reference the app's own theme variables (theme.css) rather than a
// baked-in palette, so the editor automatically matches whichever of the
// four themes (ascii/modern × dark/light) is active — CSS custom properties
// resolve live against the DOM, not at the point this extension is built.
const highlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: "var(--accent-magenta)" },
  { tag: [tags.string, tags.character], color: "var(--accent-green)" },
  { tag: [tags.number, tags.bool, tags.null], color: "var(--accent-amber)" },
  { tag: tags.comment, color: "var(--text-faint)", fontStyle: "italic" },
  {
    tag: [tags.function(tags.variableName), tags.function(tags.definition(tags.variableName))],
    color: "var(--accent-blue)",
  },
  { tag: [tags.typeName, tags.className], color: "var(--accent-cyan)" },
  { tag: tags.operator, color: "var(--text-dim)" },
  { tag: [tags.variableName, tags.propertyName], color: "var(--text)" },
  { tag: tags.punctuation, color: "var(--text-dim)" },
]);

// `fill` (Source lens, the Editor app) sizes to a flex parent's own height;
// an embedded code block within a longer scrolling document (a realm's
// Render() output, a docs page) has no such parent, so it caps its own
// height and scrolls internally past that instead of collapsing to 0.
function makeTheme(fill: boolean) {
  return EditorView.theme({
    "&": {
      color: "var(--text)",
      backgroundColor: "var(--bg-inset)",
      fontSize: "13px",
      ...(fill ? { height: "100%" } : { maxHeight: "400px" }),
    },
    ".cm-content": {
      fontFamily: "var(--font-mono)",
      caretColor: "var(--text)",
    },
    ".cm-gutters": {
      backgroundColor: "var(--bg-inset)",
      color: "var(--text-faint)",
      border: "none",
    },
    ".cm-activeLine": { backgroundColor: "var(--bg-elevated)" },
    ".cm-activeLineGutter": { backgroundColor: "var(--bg-elevated)" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
      backgroundColor: "var(--accent-dim)",
    },
    "&.cm-focused": { outline: "none" },
  });
}

function findImportPathDecorations(doc: string) {
  const builder = new RangeSetBuilder<Decoration>();
  for (const { path, from, to } of findImportPaths(doc)) {
    builder.add(
      from,
      to,
      Decoration.mark({ class: "cm-gno-import-link", attributes: { "data-import-path": path } })
    );
  }
  return builder.finish();
}

/** Makes every "gno.land/r/..." or "gno.land/p/..." import path inside an
 * import statement a clickable link — computed once against the initial
 * doc (fine for a read-only view, which never changes after mount). */
function gnoImportLinkExtension(doc: string, onImportClick: (packagePath: string) => void): Extension {
  return [
    EditorView.decorations.of(findImportPathDecorations(doc)),
    EditorView.domEventHandlers({
      click(event) {
        const path = (event.target as HTMLElement | null)
          ?.closest(".cm-gno-import-link")
          ?.getAttribute("data-import-path");
        if (!path) return false;
        onImportClick(path);
        return true;
      },
    }),
    EditorView.theme({
      ".cm-gno-import-link": { textDecoration: "underline", cursor: "pointer", color: "var(--accent)" },
    }),
  ];
}

export function CodeEditor({
  value,
  onChange,
  readOnly = false,
  language = "go",
  fill = true,
  onImportClick,
}: {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  /** "text" skips Go tokenization entirely — for a non-.gno file (a
   * package's README, gnomod.toml, ...) where treating English prose or TOML
   * as Go source would highlight coincidental keyword matches (e.g. the
   * word "for") as if they were real Go keywords. Callers that show more
   * than one file should key this component by file path/name so switching
   * files remounts a fresh editor instead of trying to hot-swap the
   * language of a live instance. */
  language?: "go" | "text";
  /** False for a code block embedded inside a longer scrolling document
   * (a realm's Render() output, a docs page) rather than filling a
   * dedicated pane (the Source lens, the Editor app). */
  fill?: boolean;
  /** When provided (Source lens only, so far), makes import paths clickable
   * — called with the raw package path (e.g. "gno.land/p/demo/avl"). */
  onImportClick?: (packagePath: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  // Lets the update listener below tell "the doc changed because our own
  // onChange fired a re-render with a new `value`" apart from "the doc
  // changed because the user typed" — without it, every keystroke would
  // loop back through the value prop and fight the editor's own cursor.
  const lastEmitted = useRef(value);

  useEffect(() => {
    if (!hostRef.current) return;

    const extensions: Extension[] = [
      readOnly ? minimalSetup : basicSetup,
      ...(language === "go" ? [go(), syntaxHighlighting(highlightStyle)] : []),
      makeTheme(fill),
      EditorView.editable.of(!readOnly),
      EditorView.lineWrapping,
      ...(language === "go" && onImportClick ? [gnoImportLinkExtension(value, onImportClick)] : []),
    ];
    if (!readOnly) {
      extensions.push(
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const next = update.state.doc.toString();
            lastEmitted.current = next;
            onChange?.(next);
          }
        })
      );
    }

    const view = new EditorView({
      state: EditorState.create({ doc: value, extensions }),
      parent: hostRef.current,
    });
    viewRef.current = view;
    return () => view.destroy();
    // Deliberately mount-once (empty deps): `value` updates after this point
    // are applied via the sync effect below (so external changes, e.g.
    // switching which file is open, replace the doc without tearing down
    // and losing focus/undo history on every render). `readOnly`/`onChange`/
    // `language`/`fill` genuinely changing at runtime isn't a case this
    // component supports.
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || value === lastEmitted.current) return;
    lastEmitted.current = value;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
    });
  }, [value]);

  return <div className="code-editor" ref={hostRef} />;
}
