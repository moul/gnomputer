import { describe, expect, it, vi } from "vitest";
import type { NetworkConfig } from "@gnomputer/app-sdk";
import { buildCommands, matchCommands, type PaletteCommand } from "./palette-commands";
import { THEME_ORDER } from "./theme-store";

const NETWORKS = [
  { id: "topaz", name: "Topaz", chainId: "test13" },
  { id: "betanet", name: "Betanet", chainId: "beta" },
] as unknown as NetworkConfig[];

function build(activeNetworkId = "topaz", setNetwork = vi.fn(), openWindowCount = 2) {
  return buildCommands({ networks: NETWORKS, activeNetworkId, setNetwork, openWindowCount });
}

describe("buildCommands", () => {
  it("offers every theme", () => {
    const labels = build().map((c) => c.id);
    for (const theme of THEME_ORDER) expect(labels).toContain(`theme:${theme}`);
  });

  it("omits the network you are already on", () => {
    // Offering "Network: Topaz" while connected to Topaz is a no-op dressed
    // up as an action, and it pushes a real option off a five-row list.
    const ids = build("topaz").map((c) => c.id);
    expect(ids).not.toContain("network:topaz");
    expect(ids).toContain("network:betanet");
  });

  it("passes the whole config to the switcher, not just the id", () => {
    // The SDK needs the endpoint, not a name to look up — a custom network
    // is not in any registry the SDK could resolve an id against.
    const setNetwork = vi.fn();
    const command = build("topaz", setNetwork).find((c) => c.id === "network:betanet");
    command!.run();
    expect(setNetwork).toHaveBeenCalledWith(NETWORKS[1]);
  });

  it("has no duplicate ids", () => {
    const ids = build().map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("matchCommands", () => {
  const commands: PaletteCommand[] = [
    { id: "a", label: "Zoom in", keywords: ["bigger"], run: () => undefined },
    { id: "b", label: "Zoom out", keywords: ["smaller"], run: () => undefined },
    { id: "c", label: "Settings: Theme", keywords: ["appearance"], run: () => undefined },
  ];

  it("returns nothing for an empty query", () => {
    expect(matchCommands("", commands)).toEqual([]);
  });

  it("finds commands by a prefix of the label", () => {
    expect(matchCommands("zoom", commands).map((c) => c.id).sort()).toEqual(["a", "b"]);
  });

  it("finds a command by a keyword that is not in its label", () => {
    expect(matchCommands("appearance", commands).map((c) => c.id)).toEqual(["c"]);
  });

  it("ranks a label hit above a keyword hit", () => {
    // Keywords exist so "appearance" can reach Theme, not so a keyword
    // collision can outrank something typed by its actual name.
    const withCollision: PaletteCommand[] = [
      { id: "keyword", label: "Reset zoom", keywords: ["theme"], run: () => undefined },
      { id: "label", label: "Settings: Theme", run: () => undefined },
    ];
    expect(matchCommands("theme", withCollision).map((c) => c.id)).toEqual(["label", "keyword"]);
  });

  it("is case-insensitive", () => {
    expect(matchCommands("ZOOM IN", commands).map((c) => c.id)).toEqual(["a"]);
  });

  it("caps the result count", () => {
    expect(matchCommands("zoom", commands, 1)).toHaveLength(1);
  });

  it("finds themes by their colour word", () => {
    const themes = build().filter((c) => c.id.startsWith("theme:"));
    const dark = matchCommands("dark", themes, 10).map((c) => c.id);
    expect(dark).toContain("theme:ascii-dark");
    expect(dark).toContain("theme:modern-dark");
    expect(dark).not.toContain("theme:ascii-light");
  });
});

describe("commands that cannot act are not offered", () => {
  it("hides Show all windows below two open windows", () => {
    // Overview deliberately refuses to engage with one window — one tile is
    // not an overview. Listing it anyway produced a palette row that
    // silently did nothing, which is the exact failure the effect-based e2e
    // in palette-apps.spec.ts exist to catch.
    expect(build("topaz", vi.fn(), 1).map((c) => c.id)).not.toContain("windows:overview");
    expect(build("topaz", vi.fn(), 0).map((c) => c.id)).not.toContain("windows:overview");
  });

  it("offers it once a second window is open", () => {
    expect(build("topaz", vi.fn(), 2).map((c) => c.id)).toContain("windows:overview");
  });
});
