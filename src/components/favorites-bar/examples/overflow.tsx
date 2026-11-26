import {
  FavoritesBar,
  FavoritesBarFolder,
  FavoritesBarItem,
  FavoritesBarOverflow,
} from "macalicious/favorites-bar";

export default function Overflow() {
  return (
    <FavoritesBar
      aria-label="Favorites"
      overflow={<FavoritesBarOverflow aria-label="More favorites" />}
      style={{ width: 260 }}
    >
      <FavoritesBarItem href="https://example.com/">Example</FavoritesBarItem>
      <FavoritesBarItem href="https://example.org/">Reference</FavoritesBarItem>
      <FavoritesBarFolder>News</FavoritesBarFolder>
      <FavoritesBarFolder>Travel</FavoritesBarFolder>
      <FavoritesBarItem href="https://example.net/">Weather</FavoritesBarItem>
    </FavoritesBar>
  );
}
