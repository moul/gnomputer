import { describe, it, expect } from "vitest";
import { isCrossingSignature, formatFuncSignature, type FuncSignature } from "./shell-app";

const CROSSING_TYPE =
  "interface {.seal func(); Address func() .uverse.address; IsCode func() bool; IsCurrent func() bool; IsEphemeral func() bool; IsUser func() bool; IsUserCall func() bool; IsUserRun func() bool; PkgPath func() string; Previous func() .uverse.realm; String func() string; Sub func(string) .uverse.realm; Subpath func() string}";

describe("isCrossingSignature", () => {
  it("detects a crossing function whose first param is unnamed in source (comes back as \".arg_0\")", () => {
    const fn: FuncSignature = {
      FuncName: "ModAddPost",
      Params: [
        { Name: ".arg_0", Type: CROSSING_TYPE },
        { Name: "slug", Type: "string" },
      ],
      Results: null,
    };
    expect(isCrossingSignature(fn)).toBe(true);
  });

  it("detects a crossing function whose first param IS named in source (e.g. \"cur realm\")", () => {
    const fn: FuncSignature = {
      FuncName: "NewPostProposalRequest",
      Params: [
        { Name: "cur", Type: CROSSING_TYPE },
        { Name: "slug", Type: "string" },
      ],
      Results: null,
    };
    expect(isCrossingSignature(fn)).toBe(true);
  });

  it("returns false for a plain function with no realm-typed first param", () => {
    const fn: FuncSignature = { FuncName: "Render", Params: [{ Name: "path", Type: "string" }], Results: null };
    expect(isCrossingSignature(fn)).toBe(false);
  });

  it("returns false for a function with no params at all", () => {
    const fn: FuncSignature = { FuncName: "Init", Params: null, Results: null };
    expect(isCrossingSignature(fn)).toBe(false);
  });
});

describe("formatFuncSignature", () => {
  it("hides the crossing param (however it's named) and flags the signature as [crossing]", () => {
    const fn: FuncSignature = {
      FuncName: "ModAddPost",
      Params: [
        { Name: ".arg_0", Type: CROSSING_TYPE },
        { Name: "slug", Type: "string" },
        { Name: "title", Type: "string" },
      ],
      Results: null,
    };
    expect(formatFuncSignature(fn)).toBe("ModAddPost(slug string, title string) [crossing]");
  });

  it("shows a plain function's real params and result type, with no [crossing] flag", () => {
    const fn: FuncSignature = {
      FuncName: "Render",
      Params: [{ Name: "path", Type: "string" }],
      Results: [{ Name: ".res.0", Type: "string" }],
    };
    expect(formatFuncSignature(fn)).toBe("Render(path string): string");
  });

  it("renders a function with no params and no results plainly", () => {
    const fn: FuncSignature = { FuncName: "Init", Params: null, Results: null };
    expect(formatFuncSignature(fn)).toBe("Init()");
  });
});
