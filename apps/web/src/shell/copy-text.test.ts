import { afterEach, describe, expect, it, vi } from "vitest";

const original = Object.getOwnPropertyDescriptor(globalThis.navigator, "clipboard");

function setClipboard(value: unknown) {
  Object.defineProperty(globalThis.navigator, "clipboard", {
    value,
    configurable: true,
    writable: true,
  });
}

afterEach(() => {
  if (original) Object.defineProperty(globalThis.navigator, "clipboard", original);
  else setClipboard(undefined);
  vi.restoreAllMocks();
});

describe("copyText", () => {
  it("uses the clipboard API when it works", async () => {
    const { copyText } = await import("./copy-text");
    const writeText = vi.fn(() => Promise.resolve());
    setClipboard({ writeText });

    expect(await copyText("hello")).toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("falls back when the clipboard API is missing", async () => {
    // Insecure origins have no navigator.clipboard at all. Without a
    // fallback the button would report success and copy nothing.
    const { copyText } = await import("./copy-text");
    setClipboard(undefined);
    const exec = vi.fn(() => true);
    (document as unknown as { execCommand: unknown }).execCommand = exec;

    expect(await copyText("hello")).toBe(true);
    expect(exec).toHaveBeenCalledWith("copy");
  });

  it("falls back when the clipboard API rejects", async () => {
    // writeText rejects on a denied permission or an unfocused document —
    // both recoverable, neither a reason to tell the user it worked.
    const { copyText } = await import("./copy-text");
    setClipboard({ writeText: () => Promise.reject(new Error("NotAllowedError")) });
    const exec = vi.fn(() => true);
    (document as unknown as { execCommand: unknown }).execCommand = exec;

    expect(await copyText("hello")).toBe(true);
    expect(exec).toHaveBeenCalled();
  });

  it("reports failure rather than claiming success", async () => {
    // "Copied!" over a clipboard that still holds something else sends the
    // wrong link to whoever you paste it for.
    const { copyText } = await import("./copy-text");
    setClipboard(undefined);
    (document as unknown as { execCommand: unknown }).execCommand = () => false;

    expect(await copyText("hello")).toBe(false);
  });

  it("removes the fallback textarea whether or not the copy worked", async () => {
    const { copyText } = await import("./copy-text");
    setClipboard(undefined);
    (document as unknown as { execCommand: unknown }).execCommand = () => false;

    await copyText("hello");
    expect(document.querySelectorAll("textarea")).toHaveLength(0);
  });
});

describe("prefersNativeShare", () => {
  it("is false on a desktop, even where navigator.share exists", async () => {
    // The OS share panel is slower and more surprising than the clipboard
    // for what is almost always a paste into something already open.
    const { prefersNativeShare } = await import("./copy-text");
    Object.defineProperty(navigator, "share", { value: () => Promise.resolve(), configurable: true });
    Object.defineProperty(navigator, "maxTouchPoints", { value: 0, configurable: true });
    expect(prefersNativeShare()).toBe(false);
  });

  it("is true on a touch device that offers a share sheet", async () => {
    const { prefersNativeShare } = await import("./copy-text");
    Object.defineProperty(navigator, "share", { value: () => Promise.resolve(), configurable: true });
    Object.defineProperty(navigator, "maxTouchPoints", { value: 5, configurable: true });
    expect(prefersNativeShare()).toBe(true);
  });

  it("is false where there is no share sheet at all", async () => {
    const { prefersNativeShare } = await import("./copy-text");
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    Object.defineProperty(navigator, "maxTouchPoints", { value: 5, configurable: true });
    expect(prefersNativeShare()).toBe(false);
  });
});
