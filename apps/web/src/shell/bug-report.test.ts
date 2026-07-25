import { describe, it, expect } from "vitest";
import { crashReportUrl, generalBugReportUrl } from "./bug-report";
import type { GnomputerSDK } from "@gnomputer/app-sdk";

function fakeSdk(): GnomputerSDK {
  return {
    networks: { getActive: () => ({ id: "topaz", name: "Topaz" }) },
  } as unknown as GnomputerSDK;
}

describe("crashReportUrl", () => {
  it("builds a GitHub new-issue URL with the error message as the title and the stack in the body", () => {
    const url = crashReportUrl(new Error("boom"));
    expect(url.startsWith(`${__GIT_REPO__}/issues/new?`)).toBe(true);
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.get("title")).toBe("Crash: boom");
    expect(params.get("labels")).toBe("bug");
    expect(params.get("body")).toContain("Error: boom");
  });
});

describe("generalBugReportUrl", () => {
  it("builds a GitHub new-issue URL with blank prompts and network/build context by default", () => {
    const url = generalBugReportUrl(fakeSdk());
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.get("title")).toBe("Bug: ");
    expect(params.get("labels")).toBe("bug");
    expect(params.get("body")).toContain("Topaz (topaz)");
    expect(params.get("body")).toContain("What happened?");
  });

  it("includes the reporter's own description instead of the blank prompt", () => {
    const url = generalBugReportUrl(fakeSdk(), "The island bar disappears on resize");
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.get("body")).toContain("The island bar disappears on resize");
    expect(params.get("body")).not.toContain("_(fill in)_");
  });

  it("omits unchecked context fields entirely", () => {
    const url = generalBugReportUrl(fakeSdk(), "", {
      url: false,
      network: false,
      build: true,
      userAgent: false,
      trail: false,
      windowSetup: false,
    });
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.get("body")).toContain(`Build: ${__GIT_HASH__}`);
    expect(params.get("body")).not.toContain("Network:");
    expect(params.get("body")).not.toContain("URL:");
    expect(params.get("body")).not.toContain("User agent:");
  });

  it("omits the Context section entirely when every field is unchecked", () => {
    const url = generalBugReportUrl(fakeSdk(), "repro steps", {
      url: false,
      network: false,
      build: false,
      userAgent: false,
      trail: false,
      windowSetup: false,
    });
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.get("body")).not.toContain("**Context**");
  });

  it("includes the trail summary only when trail is checked and a summary was supplied", () => {
    const checked = generalBugReportUrl(
      fakeSdk(),
      "",
      { url: false, network: false, build: false, userAgent: false, trail: true, windowSetup: false },
      { trailSummary: "Home → gno.land/r/gnoland/blog" },
    );
    expect(new URLSearchParams(checked.split("?")[1]).get("body")).toContain(
      "Trail: Home → gno.land/r/gnoland/blog",
    );

    const uncheckedButSupplied = generalBugReportUrl(
      fakeSdk(),
      "",
      { url: false, network: false, build: false, userAgent: false, trail: false, windowSetup: false },
      { trailSummary: "Home → gno.land/r/gnoland/blog" },
    );
    expect(new URLSearchParams(uncheckedButSupplied.split("?")[1]).get("body")).not.toContain("Trail:");
  });

  it("includes the window setup summary only when windowSetup is checked and a summary was supplied", () => {
    const url = generalBugReportUrl(
      fakeSdk(),
      "",
      { url: false, network: false, build: false, userAgent: false, trail: false, windowSetup: true },
      { windowSetupSummary: "Browser (open), Discover (closed)" },
    );
    expect(new URLSearchParams(url.split("?")[1]).get("body")).toContain(
      "Windows: Browser (open), Discover (closed)",
    );
  });
});
