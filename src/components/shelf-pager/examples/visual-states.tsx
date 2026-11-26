import { ShelfPager } from "macalicious/shelf-pager";

/**
 * Fixture for what no screenshot shows: a pager 120 x 44 pt on TV's page colour. The leading
 * chevron's box is at x 13.5 to 26.5 and the trailing one's at x 93.5 to 106.5, both from y
 * 7.5 to 36.5.
 */
export default function VisualStates() {
  return (
    <div style={{ width: 120, height: 44, background: "light-dark(#ffffff, #1e2022)" }}>
      <ShelfPager nextDisabled style={{ height: 44 }} />
    </div>
  );
}
