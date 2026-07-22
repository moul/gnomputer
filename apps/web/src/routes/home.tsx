import { useEffect, useState } from "react";
import { useSearch, useNavigate } from "@tanstack/react-router";
import { RealmBrowser } from "./realm-browser";
import { SourceExplorer } from "./source-explorer";
import { TrailBreadcrumb } from "../shell/trail-breadcrumb";

const FEATURED_PACKAGE = "gno.land/r/sys/users";

export function Home() {
  const search = useSearch({ strict: false }) as { pkg?: string };
  const navigate = useNavigate();
  const packagePath = search.pkg ?? FEATURED_PACKAGE;
  const [draftPackagePath, setDraftPackagePath] = useState(packagePath);

  useEffect(() => {
    setDraftPackagePath(packagePath);
  }, [packagePath]);

  return (
    <div className="home-layout">
      <p className="home-lede home-lede--primary">You are browsing the shared computer.</p>
      <p className="home-lede">
        Open any program, user, function or transaction to follow it through the world.
      </p>
      <TrailBreadcrumb />
      <form
        className="open-package-form"
        onSubmit={(e) => {
          e.preventDefault();
          void navigate({ to: "/", search: { pkg: draftPackagePath } });
        }}
      >
        <label>
          Open a package path
          <input
            value={draftPackagePath}
            onChange={(e) => setDraftPackagePath(e.target.value)}
            placeholder="gno.land/r/sys/names"
          />
        </label>
        <button type="submit">Open</button>
      </form>
      <div className="home-layout__panes">
        <RealmBrowser packagePath={packagePath} />
        <SourceExplorer packagePath={packagePath} />
      </div>
    </div>
  );
}
