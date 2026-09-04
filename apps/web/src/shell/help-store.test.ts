import { describe, it, expect, beforeEach } from "vitest";
import { FIRST_RUN_DISMISSED_KEY, parseHelpState, useHelpStore } from "./help-store";

beforeEach(() => {
  useHelpStore.setState({ done: [], showActions: false });
});

describe("the first-run key", () => {
  it("keeps the name the dismissible note used", () => {
    // Already in real users' IndexedDB. Renaming it would greet every
    // returning visitor as new, opening an unasked-for window — and
    // use-retire-orphaned-state writes this exact key too.
    expect(FIRST_RUN_DISMISSED_KEY).toBe("first-run-note-dismissed");
  });
});

describe("useHelpStore", () => {
  it("records a step as done", () => {
    useHelpStore.getState().markDone("open-realm");
    expect(useHelpStore.getState().done).toEqual(["open-realm"]);
  });

  it("does not duplicate a step run twice", () => {
    // Steps stay clickable after completion — re-opening the Event Explorer
    // is a reasonable thing to want twice — so the same id can arrive again.
    useHelpStore.getState().markDone("watch-live");
    useHelpStore.getState().markDone("watch-live");
    expect(useHelpStore.getState().done).toEqual(["watch-live"]);
  });

  it("returns the same state object when nothing changes, so React can skip", () => {
    useHelpStore.getState().markDone("watch-live");
    const before = useHelpStore.getState().done;
    useHelpStore.getState().markDone("watch-live");
    expect(useHelpStore.getState().done).toBe(before);
  });

  it("clears progress and returns to the guide on reset", () => {
    useHelpStore.setState({ done: ["a", "b"], showActions: true });
    useHelpStore.getState().resetGuide();
    expect(useHelpStore.getState()).toMatchObject({ done: [], showActions: false });
  });
});

describe("parseHelpState", () => {
  it("round-trips what the window writes", () => {
    const stored = JSON.stringify({ done: ["open-realm", "read-source"], showActions: true });
    expect(parseHelpState(stored)).toEqual({
      done: ["open-realm", "read-source"],
      showActions: true,
    });
  });

  it("drops a `done` that is not a list of strings", () => {
    // An entry written by an older build must fall back to defaults rather
    // than hand the component something it will call .includes() on.
    expect(parseHelpState(JSON.stringify({ done: "open-realm" }))).toEqual({
      done: [],
      showActions: false,
    });
    expect(parseHelpState(JSON.stringify({ done: [1, 2] }))).toEqual({
      done: [],
      showActions: false,
    });
  });

  it("treats a missing or non-boolean showActions as the guide", () => {
    // Landing on the actions by accident would skip the introduction for
    // someone who has never seen it.
    expect(parseHelpState(JSON.stringify({ done: [] }))?.showActions).toBe(false);
    expect(parseHelpState(JSON.stringify({ done: [], showActions: "yes" }))?.showActions).toBe(
      false
    );
  });

  it("returns null for anything that is not an object", () => {
    expect(parseHelpState("not json")).toBeNull();
    expect(parseHelpState("null")).toBeNull();
    expect(parseHelpState('"a string"')).toBeNull();
    expect(parseHelpState("[]")).toEqual({ done: [], showActions: false });
  });
});
