import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GnomputerSDK } from "@gnomputer/app-sdk";
import {
  favoritePackagePath,
  favoriteUri,
  toggleFavorite,
  useFavoritesStore,
} from "./favorites-store";

function reset() {
  useFavoritesStore.setState({ favorites: [], hydrated: false });
}

function sdkWith(set: (refUri: string, label: string, favorite: boolean) => Promise<void>): GnomputerSDK {
  return { favorites: { set, list: () => Promise.resolve([]) } } as unknown as GnomputerSDK;
}

describe("favoriteUri / favoritePackagePath", () => {
  it("round-trips a realm path", () => {
    const uri = favoriteUri("topaz", "gno.land/r/gov/dao");
    expect(uri).toBe("gno://topaz/realm/gno.land/r/gov/dao");
    expect(favoritePackagePath(uri, "topaz")).toBe("gno.land/r/gov/dao");
  });

  it("does not resolve a favorite stored under a different network", () => {
    // The same path on two chains is two deployments; showing a betanet
    // favorite while connected to Topaz would offer to open something that
    // may not exist there.
    const uri = favoriteUri("betanet", "gno.land/r/gov/dao");
    expect(favoritePackagePath(uri, "topaz")).toBeNull();
  });

  it("rejects a non-realm ref rather than rendering a broken row", () => {
    expect(favoritePackagePath("gno://topaz/address/g1abc", "topaz")).toBeNull();
    expect(favoritePackagePath("gno://topaz/realm/", "topaz")).toBeNull();
  });
});

describe("toggleFavorite", () => {
  beforeEach(reset);

  it("adds, then removes on a second toggle", async () => {
    const set = vi.fn(() => Promise.resolve());
    const sdk = sdkWith(set);

    await toggleFavorite(sdk, "topaz", "gno.land/r/gov/dao", "GovDAO");
    expect(useFavoritesStore.getState().favorites).toHaveLength(1);
    expect(useFavoritesStore.getState().favorites[0]!.label).toBe("GovDAO");

    await toggleFavorite(sdk, "topaz", "gno.land/r/gov/dao", "GovDAO");
    expect(useFavoritesStore.getState().favorites).toEqual([]);
    expect(set).toHaveBeenCalledTimes(2);
  });

  it("does not duplicate when the same path is added twice in a row", () => {
    // Guards the store's own bookkeeping: apply() filters before appending,
    // so a double-add cannot produce two rows for one refUri.
    useFavoritesStore.getState().setAll([]);
    const record = { refUri: favoriteUri("topaz", "a"), label: "A", createdAt: "1" };
    useFavoritesStore.getState().apply(record, true);
    useFavoritesStore.getState().apply({ ...record, label: "A again" }, true);
    expect(useFavoritesStore.getState().favorites).toHaveLength(1);
    expect(useFavoritesStore.getState().favorites[0]!.label).toBe("A again");
  });

  it("reverts the star when the write fails", async () => {
    // Storage is best-effort everywhere else, but a star is a deliberate act
    // with a visible result — leaving it lit would claim something the
    // database will contradict on the next reload.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const sdk = sdkWith(() => Promise.reject(new Error("QuotaExceededError")));

    await toggleFavorite(sdk, "topaz", "gno.land/r/gov/dao", "GovDAO");

    expect(useFavoritesStore.getState().favorites).toEqual([]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("restores a removed favorite when the removal fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const existing = { refUri: favoriteUri("topaz", "r/x"), label: "X", createdAt: "1" };
    useFavoritesStore.getState().setAll([existing]);
    const sdk = sdkWith(() => Promise.reject(new Error("nope")));

    await toggleFavorite(sdk, "topaz", "r/x", "X");

    expect(useFavoritesStore.getState().favorites.map((f) => f.refUri)).toEqual([existing.refUri]);
    warn.mockRestore();
  });

  it("writes the network-scoped uri, not the bare path", async () => {
    const set = vi.fn(() => Promise.resolve());
    await toggleFavorite(sdkWith(set), "betanet", "gno.land/r/gov/dao", "GovDAO");
    expect(set).toHaveBeenCalledWith("gno://betanet/realm/gno.land/r/gov/dao", "GovDAO", true);
  });
});
