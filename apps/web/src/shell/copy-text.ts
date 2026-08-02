/** Copies text, and says whether it worked.
 *
 * `navigator.clipboard` is not always there and not always allowed: it is
 * undefined on insecure origins, and writeText rejects when the document
 * isn't focused or the permission is denied. Every one of those is a
 * silent no-op if you fire-and-forget it, and "Copied!" over a clipboard
 * that still holds something else is worse than an honest failure.
 *
 * The fallback is the old execCommand path. It is deprecated and it still
 * works in every browser this app runs in, which is the only thing that
 * matters for a last resort. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through — a rejected writeText is exactly when the fallback earns
    // its place.
  }

  try {
    const field = document.createElement("textarea");
    field.value = text;
    // Off-screen rather than hidden: display:none and visibility:hidden
    // both make the selection unselectable, so the copy silently does
    // nothing. readOnly stops the mobile keyboard appearing for the
    // fraction of a second the field exists.
    field.setAttribute("readonly", "");
    field.style.cssText = "position:fixed;top:-1000px;left:-1000px;opacity:0";
    document.body.appendChild(field);
    field.select();
    const ok = document.execCommand("copy");
    field.remove();
    return ok;
  } catch {
    return false;
  }
}

/** True when the platform offers a native share sheet worth preferring.
 *
 * Only on touch devices: on a desktop, navigator.share opens an OS panel
 * that is slower and more surprising than the clipboard for what is almost
 * always a paste into something already open. */
export function prefersNativeShare(): boolean {
  return typeof navigator.share === "function" && navigator.maxTouchPoints > 0;
}
