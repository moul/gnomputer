import { useEffect, useState } from "react";
import { useShellStore } from "../store";
import { useSdk } from "../sdk-context";
import { encodeGnoString } from "@gnomputer/lenses";
import { matchWholeEntity } from "./entity-patterns";
import { openEntityMatch, openRef } from "./open-ref";
import { useRealmSuggestions } from "./use-realm-suggestions";
import { useFocusTrap } from "./use-focus-trap";
import { matchApps } from "./palette-apps";
import { matchFavorites } from "./palette-favorites";
import { buildCommands, matchCommands } from "./palette-commands";
import { useCustomNetworksStore } from "./custom-networks-store";
import { useFavoriteRealms } from "./favorites-store";
import { useWindowStore } from "./window-store";
import { focusFamilyOrOpenDefault } from "./focus-family";

const USERS_PACKAGE = "gno.land/r/sys/users";

export function CommandPalette() {
  const sdk = useSdk();
  const { commandPaletteOpen, setCommandPaletteOpen } = useShellStore();
  const [query, setQuery] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [resolving, setResolving] = useState(false);
  const suggestions = useRealmSuggestions(commandPaletteOpen, query);
  const trapRef = useFocusTrap<HTMLDivElement>(commandPaletteOpen);
  const windows = useWindowStore((s) => s.windows);
  const focus = useWindowStore((s) => s.focus);
  const reopen = useWindowStore((s) => s.reopen);
  // Apps first: the README says they are reachable from here, and until now
  // they were not (AUD-046).
  const appMatches = matchApps(query);
  const favoriteMatches = matchFavorites(query, useFavoriteRealms());
  const setActiveNetwork = useShellStore((s) => s.setActiveNetwork);
  const activeNetworkId = useShellStore((s) => s.activeNetworkId);
  const customNetworks = useCustomNetworksStore((s) => s.networks);
  const commandMatches = matchCommands(
    query,
    buildCommands({
      networks: [...sdk.networks.list(), ...customNetworks],
      activeNetworkId,
      setNetwork: (config) => {
        // Both halves, in this order — the SDK owns which endpoint gets
        // queried and the store owns what the UI says it is connected to.
        // Setting one without the other shows a chain name that does not
        // match the data underneath it.
        sdk.networks.setActiveConfig(config);
        setActiveNetwork(config.id);
      },
    })
  );

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

  // A registered username has no fixed shape the regex patterns can
  // recognize on sight the way an address/block/realm path can — "moul" is
  // indistinguishable from any other word without actually asking the
  // chain. So a username lookup (whether written "@moul" or bare "moul")
  // resolves live via r/sys/users.ResolveAny rather than pattern-matching,
  // landing directly on the resolved address instead of the generic users
  // realm page.
  async function resolveAndOpenUsername(text: string): Promise<boolean> {
    const normalized = text.replace(/^@/, "").trim();
    if (normalized === "") return false;
    setResolving(true);
    try {
      const env = await sdk.rpc.evalExpression(
        USERS_PACKAGE,
        `ResolveAny(${encodeGnoString(normalized)})`,
        new Date().toISOString()
      );
      const parsed = sdk.lenses.parseUserData(env.data);
      if (parsed.found && parsed.address) {
        openRef(`gno://_/address/${parsed.address}`);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      setResolving(false);
    }
  }

  function openApp(id: string) {
    focusFamilyOrOpenDefault([id], id, windows, { focus, reopen });
    setQuery("");
    setNotFound(false);
    setCommandPaletteOpen(false);
  }

  async function submit() {
    // An app name beats entity resolution: typing "editor" means the
    // Editor, not a realm or a username that happens to be spelled that
    // way. Only an exact or prefix match wins, so a realm path containing
    // an app's name still resolves as a realm.
    const topApp = appMatches[0];
    if (topApp && topApp.label.toLowerCase().startsWith(query.trim().toLowerCase())) {
      openApp(topApp.id);
      return;
    }

    const match = matchWholeEntity(query);
    if (match && match.kind !== "username") {
      openEntityMatch(match.kind, match.text);
      setQuery("");
      setNotFound(false);
      setCommandPaletteOpen(false);
      return;
    }

    // Either "@moul" (matched as kind "username") or a bare word like
    // "moul" that matched nothing at all — both are worth trying as a
    // username before giving up.
    const resolved = await resolveAndOpenUsername(match ? match.text : query);
    if (!resolved) {
      setNotFound(true);
      return;
    }
    setQuery("");
    setNotFound(false);
    setCommandPaletteOpen(false);
  }

  return (
    <div
      ref={trapRef}
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
            void submit();
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
            list="command-palette-suggestions"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setNotFound(false);
            }}
            placeholder="Search or run a command — realm, @user, g1 address, #block, &quot;theme&quot;, &quot;zoom&quot;…"
          />
          <datalist id="command-palette-suggestions">
            {suggestions.map((s) => (
              <option key={s.packagePath} value={s.packagePath} label={s.label} />
            ))}
          </datalist>
        </form>
        {appMatches.length > 0 && (
          <ul className="command-palette__apps">
            {appMatches.map((app) => (
              <li key={app.id}>
                <button type="button" onClick={() => openApp(app.id)}>
                  <span aria-hidden="true">{app.icon}</span> {app.label}
                </button>
              </li>
            ))}
          </ul>
        )}
        {favoriteMatches.length > 0 && (
          <ul className="command-palette__apps command-palette__favorites">
            {favoriteMatches.map((favorite) => (
              <li key={favorite.packagePath}>
                <button
                  type="button"
                  onClick={() => {
                    openEntityMatch("realm", favorite.packagePath);
                    setQuery("");
                    setNotFound(false);
                    setCommandPaletteOpen(false);
                  }}
                >
                  <span aria-hidden="true">★</span> {favorite.label}
                  <span className="command-palette__path">{favorite.packagePath}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {commandMatches.length > 0 && (
          <ul className="command-palette__apps command-palette__commands">
            {commandMatches.map((command) => (
              <li key={command.id}>
                <button
                  type="button"
                  onClick={() => {
                    command.run();
                    setQuery("");
                    setNotFound(false);
                    setCommandPaletteOpen(false);
                  }}
                >
                  {/* Marker and label in one span: the row is
                      space-between so a hint can sit at the right edge,
                      and a bare text node beside the marker got flung
                      there instead — every label right-aligned against
                      nothing. */}
                  <span>
                    <span aria-hidden="true">▸</span> {command.label}
                  </span>
                  {command.hint && <span className="command-palette__path">{command.hint}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        {resolving && (
          <p className="command-palette__hint" aria-busy="true">
            Looking up &ldquo;{query}&rdquo;…
          </p>
        )}
        {notFound && !resolving && (
          <p className="command-palette__hint">
            That doesn't match a command, app, favorite, address, block number, realm path or known
            username yet — keep typing.
          </p>
        )}
      </div>
    </div>
  );
}
