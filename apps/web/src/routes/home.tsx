import { RealmBrowser } from "./realm-browser";
import { SourceExplorer } from "./source-explorer";

const FEATURED_PACKAGE = "gno.land/r/sys/users";

export function Home() {
  return (
    <div className="home-layout">
      <p>You are browsing the shared computer.</p>
      <p>Open any program, user, function or transaction to follow it through the world.</p>
      <div className="home-layout__panes">
        <RealmBrowser packagePath={FEATURED_PACKAGE} />
        <SourceExplorer packagePath={FEATURED_PACKAGE} />
      </div>
    </div>
  );
}
