import { ShelfPager } from "macalicious/shelf-pager";

/**
 * Visual comparison target: the leading chevron of a TV shelf, disabled, in the window's left
 * margin. Reference crop w=56 h=88, i.e. 28 x 44 pt, starting 2 pt after the window's left
 * edge (x=112) and centred on the chevron: the pager's left edge is 2 pt before the fixture's.
 */
export default function VisualPrevious() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 28,
        height: 44,
        background: "light-dark(#ffffff, #1e2022)",
      }}
    >
      <ShelfPager
        previousDisabled
        style={{ position: "absolute", left: -2, top: 0, width: 120, height: 44 }}
      />
    </div>
  );
}
