import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { GnomputerSDK } from "@gnomputer/app-sdk";
import { SdkProvider } from "./sdk-context";

// The events feed is the input under test, so it is the thing to control.
// Everything else about the hook — priming, the high-water mark, resetting on
// a realm change — is what is being asserted.
const liveEvents = vi.hoisted(() => ({ current: [] as { height: number; type: string }[] }));
vi.mock("./use-live-events", () => ({
  useLiveEvents: () => ({ events: liveEvents.current, isError: false }),
}));

const { useRealmChangeWatch } = await import("./use-realm-change-watch");

const sdk = {
  networks: { getActive: () => ({ id: "topaz" }) },
} as unknown as GnomputerSDK;

let client: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={client}>
      <SdkProvider overrideSdk={sdk}>{children}</SdkProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  liveEvents.current = [];
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function render(packagePath = "gno.land/r/demo/counter", enabled = true) {
  return renderHook(({ p, e }: { p: string; e: boolean }) => useRealmChangeWatch(p, e), {
    wrapper,
    initialProps: { p: packagePath, e: enabled },
  });
}

describe("useRealmChangeWatch", () => {
  it("reports no change on a realm that has not changed", () => {
    const { result } = render();
    expect(result.current.change).toBeNull();
  });

  it("does not announce events that happened before you arrived", () => {
    // The high-water mark is primed from whatever the feed already holds.
    // Without that, every realm with any history would badge itself the
    // moment you opened it, which is worse than not having the feature.
    liveEvents.current = [
      { height: 500, type: "Increment" },
      { height: 499, type: "Increment" },
    ];
    const { result, rerender } = render();
    rerender({ p: "gno.land/r/demo/counter", e: true });
    expect(result.current.change).toBeNull();
  });

  it("announces a change once a newer block arrives", () => {
    liveEvents.current = [{ height: 500, type: "Increment" }];
    const { result, rerender } = render();
    expect(result.current.change).toBeNull();

    act(() => {
      liveEvents.current = [{ height: 501, type: "Increment" }, { height: 500, type: "Increment" }];
    });
    rerender({ p: "gno.land/r/demo/counter", e: true });

    expect(result.current.change).toEqual({ height: 501, eventType: "Increment", count: 1 });
  });

  it("counts every event in the batch, not just the newest", () => {
    liveEvents.current = [{ height: 500, type: "Increment" }];
    const { result, rerender } = render();
    act(() => {
      liveEvents.current = [
        { height: 503, type: "Transfer" },
        { height: 502, type: "Increment" },
        { height: 500, type: "Increment" },
      ];
    });
    rerender({ p: "gno.land/r/demo/counter", e: true });
    expect(result.current.change).toEqual({ height: 503, eventType: "Transfer", count: 2 });
  });

  it("does not re-announce the same height", () => {
    liveEvents.current = [{ height: 500, type: "A" }];
    const { result, rerender } = render();
    act(() => {
      liveEvents.current = [{ height: 501, type: "B" }, { height: 500, type: "A" }];
    });
    rerender({ p: "gno.land/r/demo/counter", e: true });
    expect(result.current.change?.height).toBe(501);

    act(() => result.current.acknowledge());
    rerender({ p: "gno.land/r/demo/counter", e: true });
    // Same feed contents, already accounted for: nothing new to say.
    expect(result.current.change).toBeNull();
  });

  it("can be dismissed", () => {
    liveEvents.current = [{ height: 500, type: "A" }];
    const { result, rerender } = render();
    act(() => {
      liveEvents.current = [{ height: 501, type: "B" }, { height: 500, type: "A" }];
    });
    rerender({ p: "gno.land/r/demo/counter", e: true });
    expect(result.current.change).not.toBeNull();
    act(() => result.current.acknowledge());
    expect(result.current.change).toBeNull();
  });

  it("forgets its high-water mark when the realm changes", () => {
    // A mark from another package means nothing here. Carrying it over would
    // either suppress a real change or invent one.
    liveEvents.current = [{ height: 500, type: "A" }];
    const { result, rerender } = render("gno.land/r/demo/one");
    act(() => {
      liveEvents.current = [{ height: 501, type: "B" }, { height: 500, type: "A" }];
    });
    rerender({ p: "gno.land/r/demo/one", e: true });
    expect(result.current.change).not.toBeNull();

    // Navigating to a different realm clears the notice rather than carrying
    // the previous realm's change onto it.
    rerender({ p: "gno.land/r/demo/two", e: true });
    expect(result.current.change).toBeNull();
  });

  it("stays silent while disabled", () => {
    liveEvents.current = [{ height: 500, type: "A" }];
    const { result, rerender } = render("gno.land/r/demo/counter", false);
    act(() => {
      liveEvents.current = [{ height: 999, type: "B" }, { height: 500, type: "A" }];
    });
    rerender({ p: "gno.land/r/demo/counter", e: false });
    expect(result.current.change).toBeNull();
  });

  it("stays silent with no realm open", () => {
    liveEvents.current = [{ height: 999, type: "B" }];
    const { result } = render("", true);
    expect(result.current.change).toBeNull();
  });

  it("invalidates the render query so the view shows the new state", async () => {
    // Noticing without refetching would replace one lie with a louder one:
    // a badge saying it changed, above the output from before it changed.
    const invalidate = vi.spyOn(client, "invalidateQueries");
    liveEvents.current = [{ height: 500, type: "A" }];
    const { rerender } = render();
    act(() => {
      liveEvents.current = [{ height: 501, type: "B" }, { height: 500, type: "A" }];
    });
    rerender({ p: "gno.land/r/demo/counter", e: true });

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["realm-render", "topaz", "gno.land/r/demo/counter"],
    });
  });
});
