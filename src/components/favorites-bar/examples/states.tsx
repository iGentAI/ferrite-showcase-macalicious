import { FavoritesBar, FavoritesBarFolder, FavoritesBarItem } from "macalicious/favorites-bar";

function Bar({ label }: { label: string }) {
  return (
    <FavoritesBar aria-label={label} style={{ width: 420 }}>
      <FavoritesBarItem href="https://example.com/">Example</FavoritesBarItem>
      <FavoritesBarItem href="https://example.org/" data-force="hover">
        Under the pointer
      </FavoritesBarItem>
      <FavoritesBarFolder data-force="pressed">Pressed</FavoritesBarFolder>
      <FavoritesBarItem data-force="focus">Focus</FavoritesBarItem>
      <FavoritesBarItem disabled>Disabled</FavoritesBarItem>
    </FavoritesBar>
  );
}

export default function States() {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Bar label="Favorites in the key window" />
      <div data-window-state="inactive">
        <Bar label="Favorites in an inactive window" />
      </div>
    </div>
  );
}
