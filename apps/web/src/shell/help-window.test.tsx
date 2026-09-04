import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";
import type { GnomputerSDK } from "@gnomputer/app-sdk";
import { SdkProvider } from "../sdk-context";
import { HelpWindow } from "./help-window";
import { useHelpStore, FIRST_RUN_DISMISSED_KEY } from "./help-store";
import { useWindowStore } from "./window-store";
import { useShellStore } from "../store";

// The window chrome is not what is under test here, and rendering it drags in
// drag/resize/focus machinery that has its own tests.
vi.mock("./window", () => ({
  Window: ({ children }: { children: ReactNode }) => <div data-testid="window">{children}</div>,
}));

const opened = vi.hoisted(() => ({ ids: [] as string[] }));
vi.mock("./open-ref", () => ({
  openRef: (uri: string) => {
    opened.ids.push(uri);
    return true;
  },
  focusOrReopen: (id: string) => {
    opened.ids.push(`app:${id}`);
  },
}));

/** An SDK whose stored state is a plain map, so a "first visit" is simply an
 * empty one and a returning visitor is one with the key set. */
function fakeSdk(stored: Record<string, string> = {}) {
  const store = new Map(Object.entries(stored));
  const writes: string[] = [];
  const sdk = {
    uiState: {
      get: async (key: string) => store.get(key) ?? null,
      set: async (key: string, value: string) => {
        writes.push(key);
        store.set(key, value);
      },
      keys: async (prefix: string) => [...store.keys()].filter((k) => k.startsWith(prefix)),
      remove: async () => {},
    },
  } as unknown as GnomputerSDK;
  return { sdk, writes };
}

function wrap(sdk: GnomputerSDK) {
  return function wrapper({ children }: { children: ReactNode }) {
    return <SdkProvider overrideSdk={sdk}>{children}</SdkProvider>;
  };
}

beforeEach(() => {
  opened.ids = [];
  useHelpStore.setState({ done: [], showActions: false });
  useWindowStore.setState({ windows: {} });
  useShellStore.setState({ commandPaletteOpen: false });
});

afterEach(cleanup);

describe("Help on a first visit", () => {
  it("opens itself, and records the visit so it will not do it again", async () => {
    const { sdk, writes } = fakeSdk();
    const reopen = vi.spyOn(useWindowStore.getState(), "reopen");

    render(<HelpWindow />, { wrapper: wrap(sdk) });

    await waitFor(() => expect(reopen).toHaveBeenCalledWith("help"));
    // Written when SHOWN, not when dismissed: someone who reloads rather than
    // clicking has still been introduced, and greeting them again every load
    // is the failure this guards.
    await waitFor(() => expect(writes).toContain(FIRST_RUN_DISMISSED_KEY));
  });

  it("stays shut for a visitor who has been here before", async () => {
    const { sdk } = fakeSdk({ [FIRST_RUN_DISMISSED_KEY]: "1" });
    const reopen = vi.spyOn(useWindowStore.getState(), "reopen");

    render(<HelpWindow />, { wrapper: wrap(sdk) });

    // Long enough for the storage read to have resolved and an open to have
    // happened if it were going to.
    await new Promise((r) => setTimeout(r, 30));
    expect(reopen).not.toHaveBeenCalled();
  });

  it("stays shut for someone with a saved desktop but no dismissal on record", async () => {
    // The other half of the question. Someone who has used the app for months
    // and never clicked anything still has a layout, and that is enough.
    const { sdk } = fakeSdk({ "window-layout:home:v10:pearl": "{}" });
    const reopen = vi.spyOn(useWindowStore.getState(), "reopen");

    render(<HelpWindow />, { wrapper: wrap(sdk) });

    await new Promise((r) => setTimeout(r, 30));
    expect(reopen).not.toHaveBeenCalled();
  });

  it("stays shut when storage cannot be read at all", async () => {
    // Private mode, quota, a browser that blocks IndexedDB. Opening an
    // unasked-for window on every single load is worse than never
    // introducing the app to someone whose browser cannot remember it.
    const sdk = {
      uiState: {
        get: async () => {
          throw new Error("storage unavailable");
        },
        keys: async () => {
          throw new Error("storage unavailable");
        },
        set: async () => {},
        remove: async () => {},
      },
    } as unknown as GnomputerSDK;
    const reopen = vi.spyOn(useWindowStore.getState(), "reopen");

    render(<HelpWindow />, { wrapper: wrap(sdk) });

    await new Promise((r) => setTimeout(r, 30));
    expect(reopen).not.toHaveBeenCalled();
  });
});

describe("Help and a deep link", () => {
  const setSearch = (search: string) => {
    window.history.replaceState({}, "", `/${search}`);
  };

  it("stays out of the way when the URL names a realm", async () => {
    // A shared link is somebody asking for THAT. Opening a welcome window
    // over it answers a question they did not ask, and hides the thing the
    // link was shared for.
    setSearch("?pkg=gno.land/r/sys/users");
    const { sdk, writes } = fakeSdk();
    const reopen = vi.spyOn(useWindowStore.getState(), "reopen");

    render(<HelpWindow />, { wrapper: wrap(sdk) });

    await new Promise((r) => setTimeout(r, 30));
    expect(reopen).not.toHaveBeenCalled();
    // And the visit is NOT marked seen, so a later bare visit still gets the
    // introduction rather than losing it to one shared link.
    expect(writes).not.toContain(FIRST_RUN_DISMISSED_KEY);
    setSearch("");
  });

  it("also defers to a link that only names a network", async () => {
    setSearch("?net=betanet");
    const { sdk } = fakeSdk();
    const reopen = vi.spyOn(useWindowStore.getState(), "reopen");

    render(<HelpWindow />, { wrapper: wrap(sdk) });

    await new Promise((r) => setTimeout(r, 30));
    expect(reopen).not.toHaveBeenCalled();
    setSearch("");
  });

  it("still opens when a param is present but empty", async () => {
    // "?pkg=" is the Home view, not a destination — the Browser writes it
    // that way when you navigate back out of a realm.
    setSearch("?pkg=");
    const { sdk } = fakeSdk();
    const reopen = vi.spyOn(useWindowStore.getState(), "reopen");

    render(<HelpWindow />, { wrapper: wrap(sdk) });

    await waitFor(() => expect(reopen).toHaveBeenCalledWith("help"));
    setSearch("");
  });
});

describe("Help's guide", () => {
  it("runs a step and ticks it off", async () => {
    const { sdk } = fakeSdk({ [FIRST_RUN_DISMISSED_KEY]: "1" });
    const { getByRole, container } = render(<HelpWindow />, { wrapper: wrap(sdk) });

    expect(container.querySelector(".help-window__progress")?.textContent).toBe("0/4");

    act(() => {
      getByRole("button", { name: /Watch it change/ }).click();
    });

    // The step did the thing it names, rather than only describing it.
    expect(opened.ids).toContain("app:event-explorer");
    expect(container.querySelector(".help-window__progress")?.textContent).toBe("1/4");
    // And says so in text, not only by swapping a glyph.
    expect(getByRole("button", { name: /Watch it change/ }).textContent).toContain("(done)");
  });

  it("counts only real guide steps toward progress", async () => {
    // A stored `done` from an older build could name a step that no longer
    // exists; counting it would show 5/4.
    useHelpStore.setState({ done: ["retired-step", "open-realm"] });
    const { sdk } = fakeSdk({ [FIRST_RUN_DISMISSED_KEY]: "1" });
    const { container } = render(<HelpWindow />, { wrapper: wrap(sdk) });

    expect(container.querySelector(".help-window__progress")?.textContent).toBe("1/4");
  });

  it("offers the actions before the guide is finished", async () => {
    // Someone who already knows a windowed desktop should not have to click
    // through four steps to reach the part they wanted.
    const { sdk } = fakeSdk({ [FIRST_RUN_DISMISSED_KEY]: "1" });
    const { getByRole, container } = render(<HelpWindow />, { wrapper: wrap(sdk) });

    act(() => {
      getByRole("button", { name: /Skip to things to try/ }).click();
    });

    expect(container.querySelector(".help-window__heading")?.textContent).toBe("Try something");
    expect(getByRole("button", { name: /Simulate a call/ })).toBeTruthy();
  });
});

describe("Help's actions", () => {
  it("each one opens what it names", async () => {
    useHelpStore.setState({ showActions: true });
    const { sdk } = fakeSdk({ [FIRST_RUN_DISMISSED_KEY]: "1" });
    const { getByRole } = render(<HelpWindow />, { wrapper: wrap(sdk) });

    const cases: [RegExp, string][] = [
      [/Follow something/, "gno://_/realm/gno.land/r/gnoland/blog"],
      [/Simulate a call/, "app:shell"],
      [/Write some Gno/, "app:editor"],
      [/Watch the chain/, "app:block-explorer"],
      [/Change network/, "gno://_/settings/network"],
    ];
    for (const [name, expected] of cases) {
      act(() => {
        getByRole("button", { name }).click();
      });
      expect(opened.ids).toContain(expected);
    }
  });

  it("search opens the command palette rather than a window", async () => {
    useHelpStore.setState({ showActions: true });
    const { sdk } = fakeSdk({ [FIRST_RUN_DISMISSED_KEY]: "1" });
    const { getByRole } = render(<HelpWindow />, { wrapper: wrap(sdk) });

    act(() => {
      getByRole("button", { name: /Search for something/ }).click();
    });

    expect(useShellStore.getState().commandPaletteOpen).toBe(true);
  });

  it("can go back to the guide, from the start", async () => {
    useHelpStore.setState({ showActions: true, done: ["open-realm", "read-source"] });
    const { sdk } = fakeSdk({ [FIRST_RUN_DISMISSED_KEY]: "1" });
    const { getByRole, container } = render(<HelpWindow />, { wrapper: wrap(sdk) });

    act(() => {
      getByRole("button", { name: /Show me the interface again/ }).click();
    });

    expect(container.querySelector(".help-window__progress")?.textContent).toBe("0/4");
  });
});
