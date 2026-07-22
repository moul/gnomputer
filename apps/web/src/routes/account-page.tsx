import { useEffect, useState } from "react";
import { useSearch, useNavigate } from "@tanstack/react-router";
import { AccountExplorer } from "./account-explorer";

const EXAMPLE_ADDRESS = "g1jg8mtutu9khhfwc4nxmuhcpftf0pajdhfvsqf5";

export function AccountPage() {
  const search = useSearch({ strict: false }) as { addr?: string };
  const navigate = useNavigate();
  const address = search.addr ?? EXAMPLE_ADDRESS;
  const [draftAddress, setDraftAddress] = useState(address);

  useEffect(() => {
    setDraftAddress(address);
  }, [address]);

  return (
    <div className="home-layout">
      <form
        className="open-package-form"
        onSubmit={(e) => {
          e.preventDefault();
          void navigate({ to: "/account", search: { addr: draftAddress } });
        }}
      >
        <label>
          Look up an address
          <input
            value={draftAddress}
            onChange={(e) => setDraftAddress(e.target.value)}
            placeholder="g1..."
          />
        </label>
        <button type="submit">Open</button>
      </form>
      <AccountExplorer address={address} />
    </div>
  );
}
