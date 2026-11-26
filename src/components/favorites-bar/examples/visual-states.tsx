import { FavoritesBar, FavoritesBarFolder, FavoritesBarItem } from "macalicious/favorites-bar";

/**
 * Fixture for the checks in `favorites-bar.visual.json`: no screenshot shows the bar, so the
 * checks put it into each state with real input and read pixels.
 *
 * 320 x 25 pt. The items have fixed widths, so that the pixels read do not depend on the
 * font: the bookmark's pill is x 8 to 88, the folder's x 92 to 152 with its chevron pushed
 * to x 137 to 144, the disabled item's x 156 to 236; every pill is y 2.5 to 21.5.
 */
export default function VisualStates() {
  return (
    <FavoritesBar aria-label="Favorites" style={{ width: 320 }}>
      <FavoritesBarItem id="bookmark" href="https://example.com/" style={{ width: 80 }}>
        Example
      </FavoritesBarItem>
      <FavoritesBarFolder id="folder" style={{ width: 60, justifyContent: "space-between" }}>
        News
      </FavoritesBarFolder>
      <FavoritesBarItem id="disabled" disabled style={{ width: 80 }}>
        Reference
      </FavoritesBarItem>
    </FavoritesBar>
  );
}
