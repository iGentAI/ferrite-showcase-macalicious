import { FavoritesBar, FavoritesBarFolder, FavoritesBarItem } from "macalicious/favorites-bar";

export default function Basic() {
  return (
    <FavoritesBar aria-label="Favorites" style={{ width: 420 }}>
      <FavoritesBarItem href="https://example.com/">Example</FavoritesBarItem>
      <FavoritesBarItem href="https://example.org/">Reference</FavoritesBarItem>
      <FavoritesBarFolder>News</FavoritesBarFolder>
      <FavoritesBarFolder>Travel</FavoritesBarFolder>
    </FavoritesBar>
  );
}
