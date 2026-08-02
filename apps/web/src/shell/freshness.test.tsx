import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Freshness } from "./freshness";

describe("Freshness", () => {
  afterEach(cleanup);

  it("says when the data was fetched", () => {
    render(<Freshness dataUpdatedAt={Date.now()} />);
    expect(screen.getByText(/Updated/)).toBeDefined();
  });

  it("renders nothing before anything has been fetched", () => {
    const { container } = render(<Freshness dataUpdatedAt={0} />);
    expect(container.textContent).toBe("");
  });

  it("marks data older than five minutes as possibly outdated", () => {
    render(<Freshness dataUpdatedAt={Date.now() - 6 * 60 * 1000} />);
    expect(screen.getByText(/may be outdated/)).toBeDefined();
  });

  it("says when data came from the indexer rather than the chain", () => {
    // "Updated just now" means different things by source: a chain query is
    // the chain's own answer as of that moment, while a fresh fetch of stale
    // indexer data still reads "just now" (AUD-047).
    render(<Freshness dataUpdatedAt={Date.now()} source="indexer" />);
    const badge = screen.getByText("via indexer");
    expect(badge.getAttribute("title")).toMatch(/lag behind/);
  });

  it("adds no qualifier for data read straight from the chain", () => {
    render(<Freshness dataUpdatedAt={Date.now()} source="rpc" />);
    expect(screen.queryByText("via indexer")).toBeNull();
  });
});
