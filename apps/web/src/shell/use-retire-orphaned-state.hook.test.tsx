import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";
import type { GnomputerSDK } from "@gnomputer/app-sdk";
import { SdkProvider } from "../sdk-context";
import { useRetireOrphanedState } from "./use-retire-orphaned-state";

function fakeSdk(present: string[]) {
  const removed: string[] = [];
  const written: Record<string, string> = {};
  const order: string[] = [];
  const sdk = {
    uiState: {
      get: async () => null,
      keys: async () => present,
      set: async (key: string, value: string) => {
        written[key] = value;
        order.push(`set:${key}`);
      },
      remove: async (key: string) => {
        removed.push(key);
        order.push(`remove:${key}`);
      },
    },
  } as unknown as GnomputerSDK;
  return { sdk, removed, written, order };
}

function Harness() {
  useRetireOrphanedState();
  return null;
}

function mount(sdk: GnomputerSDK) {
  return render(
    <SdkProvider overrideSdk={sdk}>
      <Harness />
    </SdkProvider>
  );
}

afterEach(cleanup);

describe("useRetireOrphanedState", () => {
  it("drops the keys the per-network change orphaned", async () => {
    const { sdk, removed } = fakeSdk([
      "realm-tabs",
      "window-layout:home:v10",
      "realm-tabs:sapphire",
      "theme",
    ]);
    mount(sdk);

    await waitFor(() => expect(removed).toContain("realm-tabs"));
    expect(removed).toContain("window-layout:home:v10");
  });

  it("leaves the live per-network keys alone", async () => {
    // `window-layout:home:v10:sapphire` starts with a retired key, so a prefix
    // match would delete the layout it just restored.
    const { sdk, removed } = fakeSdk([
      "realm-tabs",
      "realm-tabs:sapphire",
      "window-layout:home:v10:sapphire",
      "theme",
      "active-network",
    ]);
    mount(sdk);

    await waitFor(() => expect(removed).toContain("realm-tabs"));
    expect(removed).not.toContain("realm-tabs:sapphire");
    expect(removed).not.toContain("window-layout:home:v10:sapphire");
    expect(removed).not.toContain("theme");
    expect(removed).not.toContain("active-network");
  });

  it("records that someone has been here before it deletes the evidence", async () => {
    // Those keys are also what tells the first-run note this is a returning
    // visitor. Deleting them first would greet them as new.
    const { sdk, written, order } = fakeSdk(["window-layout:home:v10"]);
    mount(sdk);

    await waitFor(() => expect(written["first-run-note-dismissed"]).toBe("1"));
    expect(order.indexOf("set:first-run-note-dismissed")).toBeLessThan(
      order.indexOf("remove:window-layout:home:v10")
    );
  });

  it("does not claim a visit when only the tab state was orphaned", async () => {
    // Tabs say nothing about whether the desktop was ever laid out, so they
    // are not evidence of a previous visit.
    const { sdk, written, removed } = fakeSdk(["realm-tabs"]);
    mount(sdk);

    await waitFor(() => expect(removed).toContain("realm-tabs"));
    expect(written["first-run-note-dismissed"]).toBeUndefined();
  });

  it("writes nothing when there is nothing to retire", async () => {
    const { sdk, removed, written } = fakeSdk(["realm-tabs:sapphire", "theme"]);
    const spy = vi.spyOn(sdk.uiState, "remove");
    mount(sdk);

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(spy).not.toHaveBeenCalled();
    expect(removed).toHaveLength(0);
    expect(Object.keys(written)).toHaveLength(0);
  });
});
