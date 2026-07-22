import { useEffect, useState } from "react";
import { useSdk } from "../sdk-context";

export function WorldExplorer() {
  const sdk = useSdk();
  const [favorites, setFavorites] = useState<{ refUri: string; label: string }[]>([]);

  useEffect(() => {
    sdk.favorites.list().then(setFavorites);
  }, [sdk]);

  return (
    <section className="panel" aria-label="World Explorer">
      <header className="panel__header">
        <span>World Explorer</span>
      </header>
      <div className="panel__body">
        {favorites.length === 0 ? (
          <p className="state-line">Nothing favorited yet.</p>
        ) : (
          <ul className="world-explorer-list">
            {favorites.map((f) => (
              <li key={f.refUri}>{f.label}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
