import { describe, expect, it } from "vitest";
import { matchFavorites } from "./palette-favorites";

const FAVORITES = [
  { packagePath: "gno.land/r/gov/dao", label: "GovDAO" },
  { packagePath: "gno.land/r/sys/users", label: "Users" },
  { packagePath: "gno.land/r/demo/boards", label: "Boards" },
];

describe("matchFavorites", () => {
  it("returns nothing for an empty query", () => {
    expect(matchFavorites("", FAVORITES)).toEqual([]);
    expect(matchFavorites("   ", FAVORITES)).toEqual([]);
  });

  it("finds a favorite by a fragment of its path", () => {
    expect(matchFavorites("gov/dao", FAVORITES).map((f) => f.label)).toEqual(["GovDAO"]);
  });

  it("finds a favorite by its label", () => {
    expect(matchFavorites("boards", FAVORITES).map((f) => f.packagePath)).toEqual([
      "gno.land/r/demo/boards",
    ]);
  });

  it("is case-insensitive on both path and label", () => {
    expect(matchFavorites("GOVDAO", FAVORITES).map((f) => f.label)).toEqual(["GovDAO"]);
    expect(matchFavorites("GNO.LAND/R/SYS", FAVORITES).map((f) => f.label)).toEqual(["Users"]);
  });

  it("ranks a path hit above a label hit", () => {
    // "users" is a substring of one path and the whole of another's label.
    // Someone typing a path fragment means the path.
    const favorites = [
      { packagePath: "gno.land/r/demo/profile", label: "users" },
      { packagePath: "gno.land/r/sys/users", label: "Registry" },
    ];
    expect(matchFavorites("users", favorites).map((f) => f.label)).toEqual(["Registry", "users"]);
  });

  it("ranks an exact path above a prefix above a substring", () => {
    const favorites = [
      { packagePath: "gno.land/r/a/thing", label: "substring" },
      { packagePath: "thing", label: "exact" },
      { packagePath: "thing/nested", label: "prefix" },
    ];
    expect(matchFavorites("thing", favorites).map((f) => f.label)).toEqual([
      "exact",
      "prefix",
      "substring",
    ]);
  });

  it("caps the result count", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      packagePath: `gno.land/r/test/realm${i}`,
      label: `Realm ${i}`,
    }));
    expect(matchFavorites("realm", many, 3)).toHaveLength(3);
  });

  it("does not match a query no favorite contains", () => {
    expect(matchFavorites("zzzz", FAVORITES)).toEqual([]);
  });
});
