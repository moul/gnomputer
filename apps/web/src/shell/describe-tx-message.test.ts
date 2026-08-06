import { describe, it, expect } from "vitest";
import { describeTxMessage } from "./describe-tx-message";

describe("describeTxMessage", () => {
  it("describes a transfer by what moved", () => {
    // Topaz block 467231, which the UI used to summarise as gas and nothing
    // else.
    expect(
      describeTxMessage({
        kind: "send",
        from: "g18qhq2fl54lszhmxeyqlvxnwjzc3xpu4nnakclp",
        to: "g1sd2hazs3wgxj0xm2v07dycg27r583vjehxaxhk",
        amount: "15000000ugnot",
      })
    ).toBe("Sent 15 GNOT");
  });

  it("names the function and the realm for a call", () => {
    expect(
      describeTxMessage({
        kind: "call",
        caller: "g1zzr0xsuh4msmz6e55q9tp3yq6fu63at54lr8qu",
        packagePath: "gno.land/r/gnoswap/common",
        func: "Approve",
        args: [],
        send: "",
      })
    ).toBe("Called Approve() on gno.land/r/gnoswap/common");
  });

  it("mentions attached funds, which are the thing worth noticing", () => {
    expect(
      describeTxMessage({
        kind: "call",
        caller: "g1abc",
        packagePath: "gno.land/r/demo/x",
        func: "Buy",
        args: [],
        send: "2000000ugnot",
      })
    ).toBe("Called Buy() on gno.land/r/demo/x, sending 2 GNOT");
  });

  it("describes a deployment by package name", () => {
    expect(
      describeTxMessage({
        kind: "addpkg",
        creator: "g1j2adx6ngvawtmkhq7eexsk9uq4u9zsrealpye2",
        packagePath: "gno.land/r/g1j2adx6ngvawtmkhq7eexsk9uq4u9zsrealpye2/testtoken",
        packageName: "testtoken",
        deposit: "",
      })
    ).toBe("Deployed testtoken");
  });

  it("falls back to the path when a deployment has no package name", () => {
    expect(
      describeTxMessage({
        kind: "addpkg",
        creator: "g1abc",
        packagePath: "gno.land/r/demo/thing",
        packageName: "",
        deposit: "",
      })
    ).toBe("Deployed gno.land/r/demo/thing");
  });

  it("describes a run", () => {
    expect(describeTxMessage({ kind: "run", caller: "g1abc", send: "" })).toBe("Ran a script");
  });

  it("says what an unrecognised message was rather than nothing", () => {
    expect(describeTxMessage({ kind: "unknown", route: "vm", typeUrl: "something_new" })).toBe(
      "vm/something_new"
    );
  });
});
