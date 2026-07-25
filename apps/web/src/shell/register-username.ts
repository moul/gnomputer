import type { WalletAccount } from "./wallet-store";

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

/** Calls the real Register(username) function via Adena's DoContract — a
 * /vm.m_call message with the 1 GNOT registration fee attached as `send`,
 * exactly matching what users.gno's Register() checks for. */
export async function registerUsername(account: WalletAccount, username: string): Promise<void> {
  if (!window.adena) throw new Error("Adena is not available.");
  if (!isValidUsername(username)) {
    throw new Error(`Invalid username. ${USERNAME_FORMAT_HINT}`);
  }
  const res = await window.adena.DoContract({
    messages: [
      {
        type: "/vm.m_call",
        value: {
          caller: account.address,
          send: REGISTER_PRICE_UGNOT,
          pkg_path: USERS_REGISTRY_PACKAGE,
          func: "Register",
          args: [username],
        },
      },
    ],
  });
  if (res.status !== "success") {
    throw new Error(res.message || "Registration failed.");
  }
}
