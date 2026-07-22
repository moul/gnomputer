import { useEffect, useState } from "react";
import { useSdk } from "../sdk-context";

export function WorldExplorer() {
  const sdk = useSdk();
  const [favorites, setFavorites] = useState<{ refUri: string; label: string }[]>([]);

  useEffect(() => {
    sdk.favorites.list().then(setFavorites);
  }, [sdk]);

  return (
    <section aria-label="World Explorer">
      <h2>World Explorer</h2>
      <ul>
        {favorites.map((f) => (
          <li key={f.refUri}>{f.label}</li>
        ))}
      </ul>
    </section>
  );
}
