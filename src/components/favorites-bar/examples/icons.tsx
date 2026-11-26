import { FavoritesBar, FavoritesBarFolder, FavoritesBarItem } from "macalicious/favorites-bar";

/** A letter in a rounded square stands in for a site's icon. */
function Monogram({ letter, fill }: { letter: string; fill: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" role="presentation">
      <rect width="14" height="14" rx="3" fill={fill} />
      <text x="7" y="10.5" textAnchor="middle" fontSize="9" fontWeight="700" fill="#ffffff">
        {letter}
      </text>
    </svg>
  );
}

export default function Icons() {
  return (
    <FavoritesBar aria-label="Favorites" style={{ width: 420 }}>
      <FavoritesBarItem href="https://example.com/" icon={<Monogram letter="E" fill="#4a6da7" />}>
        Example
      </FavoritesBarItem>
      <FavoritesBarItem href="https://example.org/" icon={<Monogram letter="R" fill="#3d8f6b" />}>
        Reference
      </FavoritesBarItem>
      <FavoritesBarItem
        href="https://example.net/"
        aria-label="Weather"
        icon={<Monogram letter="W" fill="#a7664a" />}
      />
      <FavoritesBarFolder icon={<Monogram letter="N" fill="#77767c" />}>News</FavoritesBarFolder>
    </FavoritesBar>
  );
}
