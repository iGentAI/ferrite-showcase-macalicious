import { ShelfPager } from "macalicious/shelf-pager";

/**
 * Fixture for a pager in a block whose direction is set in CSS, with no `dir` attribute: the
 * chevrons swap sides and each still points outwards. 120 x 44 pt on TV's page colour; the
 * leading chevron's box is now at x 93.5 to 106.5 and the trailing, disabled one's at x 13.5
 * to 26.5.
 */
export default function VisualRtl() {
  return (
    <div
      style={{
        width: 120,
        height: 44,
        background: "light-dark(#ffffff, #1e2022)",
        direction: "rtl",
      }}
    >
      <ShelfPager nextDisabled style={{ height: 44 }} />
    </div>
  );
}
