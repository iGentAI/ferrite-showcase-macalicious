import Shelf from "./shelf";

/**
 * Fixture for paging: the shelf example of the docs page on TV's page colour, so that the
 * margins can be checked. 520 pt wide; the chevrons' boxes are at x 13.5 to 26.5 and 493.5 to
 * 506.5, and the shelf is clipped 26 pt from either edge.
 */
export default function VisualPaging() {
  return (
    <div style={{ width: 520, background: "light-dark(#ffffff, #1e2022)" }}>
      <Shelf />
    </div>
  );
}
