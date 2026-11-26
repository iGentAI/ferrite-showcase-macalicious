import { FavoritesBar, FavoritesBarItem, FavoritesBarOverflow } from "macalicious/favorites-bar";

function Bar({ label, width, shown }: { label: string; width: number; shown?: boolean }) {
  return (
    <FavoritesBar
      aria-label={label}
      overflow={
        <FavoritesBarOverflow
          aria-label={`More of ${label}`}
          style={shown ? { visibility: "visible" } : undefined}
        />
      }
      style={{ width }}
    >
      <FavoritesBarItem href="https://example.com/" style={{ width: 80 }}>
        One
      </FavoritesBarItem>
      <FavoritesBarItem href="https://example.org/" style={{ width: 80 }}>
        Two
      </FavoritesBarItem>
      <FavoritesBarItem href="https://example.net/" style={{ width: 80 }}>
        Three
      </FavoritesBarItem>
    </FavoritesBar>
  );
}

/**
 * Fixture for the overflow checks in `favorites-bar.visual.json`: the same three 80 pt items
 * in a bar that holds them (300 pt, y 0 to 25) and in one that holds two (220 pt, y 25 to
 * 50). Each bar ends with the overflow button: 19 pt wide, 8 pt from the trailing edge, with
 * its two chevrons at x -22 to -13 from that edge.
 *
 * The comparison captures with animations switched off, and the button appears through a
 * scroll-driven animation, so a capture never shows it. The second bar therefore makes its
 * button visible itself, for the check of the chevrons' drawing; that the button appears
 * without that is tested in `favorites-bar.browser.test.tsx`.
 */
export default function VisualOverflow() {
  return (
    <div style={{ width: 300 }}>
      <Bar label="a bar that fits" width={300} />
      <Bar label="a bar that does not fit" width={220} shown />
    </div>
  );
}
