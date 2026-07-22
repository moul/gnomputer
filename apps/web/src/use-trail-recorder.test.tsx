import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createGnomputerSDK } from "@gnomputer/app-sdk";
import { SdkProvider } from "./sdk-context";
import { useTrailRecorder } from "./use-trail-recorder";

describe("useTrailRecorder", () => {
  beforeEach(() => {
    indexedDB.deleteDatabase("gnomputer-trail-recorder-test");
  });

  it("starts a Trail on first use and records the visited ref", async () => {
    const sdk = createGnomputerSDK({ dbName: "gnomputer-trail-recorder-test" });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SdkProvider overrideSdk={sdk}>{children}</SdkProvider>
    );
    renderHook(
      () => useTrailRecorder({ uri: "gno://test13/realm/gno.land/r/sys/users", label: "r/sys/users" }),
      { wrapper }
    );

    await waitFor(async () => {
      const trailId = await sdk.trails.getActiveTrailId();
      expect(trailId).not.toBeNull();
      const steps = await sdk.trails.getSteps(trailId!);
      expect(steps.map((s) => s.label)).toContain("r/sys/users");
    });
  });
});
