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
  it("builds a GitHub new-issue URL with blank prompts and network/build context", () => {
    const url = generalBugReportUrl(fakeSdk());
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.get("title")).toBe("Bug: ");
    expect(params.get("labels")).toBe("bug");
    expect(params.get("body")).toContain("Topaz (topaz)");
    expect(params.get("body")).toContain("What happened?");
  });
});
