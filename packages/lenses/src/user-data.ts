export interface ParsedUserData {
  address: string | null;
  username: string | null;
  found: boolean;
}

// Matches gno.land/r/sys/users.UserData's qeval struct dump, e.g.
// `(&(struct{("g1jg8m..." .uverse.address),("test1" string),(false bool)}
// gno.land/r/sys/users.UserData) *gno.land/r/sys/users.UserData)` — the
// first two positional fields are addr and username respectively (field
// names aren't in the dump, only declaration order, confirmed live against
// gno.land/r/sys/users/store.gno's UserData struct).
const ADDRESS_FIELD = /\("([^"]+)"\s+\.uverse\.address\)/;
const USERNAME_FIELD = /\("([^"]*)"\s+string\)/;

/** Parses the raw vm/qeval result of calling ResolveAny/ResolveAddress/
 * ResolveName on gno.land/r/sys/users — a nil first line (no address/name
 * ever registered for that input) is the confirmed "not found" shape. */
export function parseUserData(raw: string): ParsedUserData {
  const trimmed = raw.trim();
  if (trimmed.startsWith("(nil")) {
    return { address: null, username: null, found: false };
  }
  return {
    address: ADDRESS_FIELD.exec(trimmed)?.[1] ?? null,
    username: USERNAME_FIELD.exec(trimmed)?.[1] ?? null,
    found: true,
  };
}
