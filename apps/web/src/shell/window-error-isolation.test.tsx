import "fake-indexeddb/auto";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, within } from "@testing-library/react";
import { ErrorBoundary } from "./error-boundary";

afterEach(cleanup);

function Boom(): React.ReactElement {
  throw new Error("app exploded");
}

describe("per-window error isolation", () => {
  it("contains a crash to its own boundary, leaving siblings rendered", () => {
    // React logs the caught error; silence it so the run stays readable.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { container } = render(
        <>
          <div data-testid="crashing">
            <ErrorBoundary>
              <Boom />
            </ErrorBoundary>
          </div>
          <div data-testid="healthy">
            <ErrorBoundary>
              <p>still here</p>
            </ErrorBoundary>
          </div>
        </>
      );

      // The crashing window shows the recovery card...
      const crashing = within(container.querySelector("[data-testid=crashing]")!);
      expect(crashing.getByText("Something went wrong!")).toBeTruthy();

      // ...and the sibling window is untouched. Before per-window
      // boundaries, a crash in any app bubbled up and replaced the entire
      // desktop, taking every other open window with it.
      const healthy = within(container.querySelector("[data-testid=healthy]")!);
      expect(healthy.getByText("still here")).toBeTruthy();
    } finally {
      spy.mockRestore();
    }
  });
});
