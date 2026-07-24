import { describe, it, expect } from "vitest";
import { gnowebRealmUrl, gnowebAddressUrl, mygnoscanAddressUrl } from "./gnoweb-links";

describe("gnowebRealmUrl", () => {
  it("strips the domain segment and joins with the gnoweb base URL", () => {
    expect(gnowebRealmUrl("https://gno.land", "gno.land/r/sys/users")).toBe("https://gno.land/r/sys/users");
  });

  it("appends a colon-suffixed render path when given", () => {
    expect(gnowebRealmUrl("https://topaz.testnets.gno.land", "gno.land/r/gov/dao", "49")).toBe(
      "https://topaz.testnets.gno.land/r/gov/dao:49"
    );
  });

  it("omits the colon suffix entirely when no render path is given", () => {
    expect(gnowebRealmUrl("https://gno.land", "gno.land/r/gov/dao")).toBe("https://gno.land/r/gov/dao");
  });
});

describe("gnowebAddressUrl", () => {
  it("builds a /u/<address> profile URL", () => {
    expect(gnowebAddressUrl("https://gno.land", "g1abc")).toBe("https://gno.land/u/g1abc");
  });
});

describe("mygnoscanAddressUrl", () => {
  it("builds an /address/<address> explorer URL", () => {
    expect(mygnoscanAddressUrl("https://explorer.topaz.testnets.gno.land", "g1abc")).toBe(
      "https://explorer.topaz.testnets.gno.land/address/g1abc"
    );
  });
});
