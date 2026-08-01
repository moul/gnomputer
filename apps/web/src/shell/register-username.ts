import type { TransactionIntent } from "./transaction-intent";

// gno.land/r/sys/users itself is read-only (ResolveName/ResolveAddress) —
// registration actually goes through its whitelisted controller realm,
// confirmed by reading both realms' source: r/sys/users/admin.gno names
// "gno.land/r/gnoland/users/v1" as the preregistered writer, and that
// realm's Register(username) is the real entry point (regex, 1 GNOT
// payment requirement, and the ResolveAny-visible result all confirmed
// there too).
export const USERS_REGISTRY_PACKAGE = "gno.land/r/gnoland/users/v1";
const REGISTER_PRICE_UGNOT = "1000000ugnot"; // matches registerPrice = 1_000_000 in users.gno
const USERNAME_PATTERN = /^[a-z]{3}[_a-z0-9]{0,14}[0-9]{3}$/;

export const USERNAME_FORMAT_HINT =
  "3+ lowercase letters, then lowercase letters/digits/underscore, ending in 3+ digits (e.g. abc123) — under 20 characters total.";

export function isValidUsername(username: string): boolean {
  return USERNAME_PATTERN.test(username);
}

/** Describes the registration as a reviewable intent instead of submitting
 * it. Building the intent and *submitting* it are deliberately separate:
 * everything routes through submitIntent() (transaction-intent.ts), which
 * is the one place that enforces the wallet/network chain-match and is
 * reached only after the user has seen a review. This function used to call
 * window.adena.DoContract directly with neither (AUD-001/002/003, #92). */
export function registerUsernameIntent(username: string): TransactionIntent {
  if (!isValidUsername(username)) {
    throw new Error(`Invalid username. ${USERNAME_FORMAT_HINT}`);
  }
  return {
    summary: `Register the username "${username}"`,
    packagePath: USERS_REGISTRY_PACKAGE,
    func: "Register",
    args: [username],
    send: REGISTER_PRICE_UGNOT,
    sendReason: "the registry's fixed registration price",
  };
}
