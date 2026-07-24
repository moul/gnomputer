import { useEffect, useState } from "react";
import { useShellStore } from "../store";
import { matchWholeEntity } from "./entity-patterns";
import { openEntityMatch } from "./open-ref";

export function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen } = useShellStore();
  const [query, setQuery] = useState("");
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      }
      if (e.key === "Escape") setCommandPaletteOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  if (!commandPaletteOpen) return null;

  function submit() {
    const match = matchWholeEntity(query);
    if (!match) {
      setNotFound(true);
      return;
    }
    openEntityMatch(match.kind, match.text);
    setQuery("");
    setNotFound(false);
    setCommandPaletteOpen(false);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="command-palette"
      onClick={(e) => {
        if (e.target === e.currentTarget) setCommandPaletteOpen(false);
      }}
    >
      <div className="command-palette__panel">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input
            type="text"
            name="command-palette-query"
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-1p-ignore="true"
            data-lpignore="true"
            data-bwignore="true"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setNotFound(false);
            }}
            placeholder="g1 address, #block, r/realm/path…"
          />
        </form>
        {notFound && (
          <p className="command-palette__hint">
            That doesn't look like an address, block number, or realm path yet — keep typing.
          </p>
        )}
      </div>
    </div>
  );
}
