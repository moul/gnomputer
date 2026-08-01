import { describe, it, expect } from "vitest";
import { connectionAnnouncement } from "./connection-announcement";

describe("connectionAnnouncement", () => {
  it("says nothing while the first status request is still in flight", () => {
    expect(connectionAnnouncement("connecting", false)).toBeNull();
  });

  it("does not announce a healthy boot", () => {
    // connecting -> connected is what every single page load does. Speaking
    // it would mean opening the app by reading out its own status.
    expect(connectionAnnouncement("connected", false)).toBeNull();
  });

  it("announces a chain that is already down at load", () => {
    // The red dot is the only other signal and it is aria-hidden, so waiting
    // for a *transition* would leave this user with nothing at all.
    const result = connectionAnnouncement("error", false);
    expect(result?.message).toMatch(/Not connected/);
    expect(result?.hadProblem).toBe(true);
  });

  it("announces a drop that happens mid-session", () => {
    expect(connectionAnnouncement("connected", false)).toBeNull();
    expect(connectionAnnouncement("error", false)?.message).toMatch(/Not connected/);
  });

  it("distinguishes being offline from the chain being unreachable", () => {
    expect(connectionAnnouncement("offline", false)?.message).toMatch(/offline/i);
  });

  it("announces recovery, but only after a problem was announced", () => {
    expect(connectionAnnouncement("connected", true)).toEqual({
      message: "Connection to the chain restored.",
      hadProblem: false,
    });
  });

  it("does not repeat a problem that is already announced", () => {
    // A polling hook re-evaluates every few seconds; re-announcing would
    // make the region flap and talk over the rest of the page.
    expect(connectionAnnouncement("error", true)).toBeNull();
    expect(connectionAnnouncement("offline", true)).toBeNull();
  });

  it("stays quiet if a refetch briefly reports connecting during an outage", () => {
    expect(connectionAnnouncement("connecting", true)).toBeNull();
  });
});
