import { ShelfPager } from "macalicious/shelf-pager";

/**
 * Visual comparison target: the trailing chevron of a TV shelf, enabled, in the window's
 * right margin. Reference crop w=56 h=88, i.e. 28 x 44 pt, ending 2 pt before the window's
 * right edge (x=2700) and centred on the chevron: the pager's right edge is 2 pt beyond the
 * fixture's.
 */
export default function VisualNext() {
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
      <ShelfPager style={{ position: "absolute", right: -2, top: 0, width: 120, height: 44 }} />
    </div>
  );
}
