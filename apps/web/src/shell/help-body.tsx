import { useHelpStore } from "./help-store";
import { useShellStore } from "../store";
import { focusOrReopen, openRef } from "./open-ref";

/** A thing to do, not a thing to read.
 *
 * Every entry here has to actually perform what it names. An onboarding list
 * whose items explain rather than act is a manual, and the reason the note
 * this replaced offered starters at all was that a claim you can click is
 * worth more than a paragraph.
 */
interface HelpAction {
  id: string;
  icon: string;
  label: string;
  /** What it does and why you'd care — one line, no marketing. */
  hint: string;
  run: () => void;
}

/**
 * Four steps that teach the interface by using it.
 *
 * Ordered so each one builds on the last: a realm on screen, then the lenses
 * that reframe it, then the feed proving it is live, then the way to reach
 * anything without hunting. Deliberately short — a tour long enough to need a
 * progress bar is a tour nobody finishes.
 */
const GUIDE: HelpAction[] = [
  {
    id: "open-realm",
    icon: "1",
    label: "Open a realm",
    hint: "GovDAO's real proposals, read live from the chain.",
    run: () => openRef("gno://_/realm/gno.land/r/gov/dao"),
  },
  {
    id: "read-source",
    icon: "2",
    label: "Read its source",
    hint: "The same realm through a different lens — Gno, straight off the chain.",
    run: () => openRef("gno://_/source-file/gno.land/r/sys/users"),
  },
  {
    id: "watch-live",
    icon: "3",
    label: "Watch it change",
    hint: "Events as blocks land. Nothing here is a snapshot.",
    run: () => focusOrReopen("event-explorer"),
  },
  {
    id: "use-palette",
    icon: "4",
    label: "Find anything fast",
    hint: "⌘K reaches every app, realm, user and block by name.",
    run: () => useShellStore.getState().setCommandPaletteOpen(true),
  },
];

/**
 * What to try once the interface makes sense.
 *
 * These stay useful long after the guide is done, which is why Help is an app
 * rather than a note that vanishes: "how do I simulate a call again" is a
 * question people have on day ten, not day one.
 */
const ACTIONS: HelpAction[] = [
  {
    id: "find",
    icon: "🔎",
    label: "Search for something",
    hint: "A realm, a username, a g1… address or a block height.",
    run: () => useShellStore.getState().setCommandPaletteOpen(true),
  },
  {
    id: "follow",
    icon: "★",
    label: "Follow something",
    hint: "Star a realm from its toolbar and it leads your home screen.",
    run: () => openRef("gno://_/realm/gno.land/r/gnoland/blog"),
  },
  {
    id: "simulate",
    icon: "⌨️",
    label: "Simulate a call",
    hint: "Evaluate any Gno expression against a live realm. Reads only — nothing is signed.",
    run: () => focusOrReopen("shell"),
  },
  {
    id: "write",
    icon: "📝",
    label: "Write some Gno",
    hint: "Draft locally from a template. Deploying it needs gnoweb and a wallet.",
    run: () => focusOrReopen("editor"),
  },
  {
    id: "chain",
    icon: "🧱",
    label: "Watch the chain",
    hint: "Blocks, transactions and what each one actually did.",
    run: () => focusOrReopen("block-explorer"),
  },
  {
    id: "switch",
    icon: "🌐",
    label: "Change network",
    hint: "Pearl, Sapphire, Topaz or your own node. Each keeps its own desktop.",
    run: () => openRef("gno://_/settings/network"),
  },
];

function ActionList({
  items,
  numbered,
  onRun,
  done,
}: {
  items: HelpAction[];
  numbered?: boolean;
  onRun: (item: HelpAction) => void;
  done?: string[];
}) {
  return (
    <ul className="help-window__list" data-numbered={numbered || undefined}>
      {items.map((item) => {
        const isDone = done?.includes(item.id) ?? false;
        return (
          <li key={item.id}>
            <button type="button" onClick={() => onRun(item)} data-done={isDone || undefined}>
              <span className="help-window__icon" aria-hidden="true">
                {isDone ? "✓" : item.icon}
              </span>
              <span className="help-window__text">
                <span className="help-window__label">{item.label}</span>
                <span className="help-window__hint">{item.hint}</span>
              </span>
              {/* Said in text too — a tick that only exists as a glyph swap
                  tells a screen reader nothing. */}
              {isDone && <span className="visually-hidden"> (done)</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Everything inside the Help window.
 *
 * Split from the window shell so it lands in its own chunk rather than in the
 * eager `index` one: Help is a window that is closed almost all of the time,
 * and the guide/action copy is the bulk of it. The shell in help-window.tsx
 * stays eager because `reopen("help")` needs the window registered — the same
 * split every other app here uses (home.tsx's LazyApp).
 */
export function HelpBody() {
  const done = useHelpStore((s) => s.done);
  const showActions = useHelpStore((s) => s.showActions);
  const markDone = useHelpStore((s) => s.markDone);
  const setShowActions = useHelpStore((s) => s.setShowActions);
  const resetGuide = useHelpStore((s) => s.resetGuide);

  const allDone = GUIDE.every((step) => done.includes(step.id));

  return (
    <div className="help-window">
      <p className="help-window__lead">You are browsing the shared computer.</p>
      <p className="help-window__body">
        Open any program, user, function or transaction to follow it through the world.
        Everything here is live chain data, read-only, and no wallet is needed.
      </p>

      {showActions ? (
        <>
          <h3 className="help-window__heading">Try something</h3>
          <ActionList items={ACTIONS} onRun={(item) => item.run()} />
          <div className="help-window__footer">
            <button
              type="button"
              className="help-window__switch"
              onClick={() => {
                resetGuide();
                setShowActions(false);
              }}
            >
              Show me the interface again
            </button>
          </div>
        </>
      ) : (
        <>
          <h3 className="help-window__heading">
            First, the interface{" "}
            <span className="help-window__progress">
              {done.filter((d) => GUIDE.some((g) => g.id === d)).length}/{GUIDE.length}
            </span>
          </h3>
          <ActionList
            items={GUIDE}
            numbered
            done={done}
            onRun={(item) => {
              item.run();
              markDone(item.id);
            }}
          />
          <div className="help-window__footer">
            {/* Available from the start rather than only once the guide is
                finished. Someone who already knows a windowed desktop should
                not have to click through four steps to reach the part they
                wanted. */}
            <button
              type="button"
              className="help-window__switch"
              onClick={() => setShowActions(true)}
            >
              {allDone ? "Done — what can I try?" : "Skip to things to try"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
