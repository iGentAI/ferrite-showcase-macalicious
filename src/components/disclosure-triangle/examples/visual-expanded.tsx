import { DisclosureTriangle } from "macalicious/disclosure-triangle";

/**
 * Visual comparison target: the expanded triangle of the "Apple" row in the outline of the
 * Desktop & Screen Saver pane (white list in Aqua, #1d1e1f in Dark Aqua).
 *
 * Reference crop (2x pixels) x=188 y=494 w=28 h=28, i.e. 14 x 14 pt. The triangle's ink spans
 * x 193 to 210 and y 501 to 515, which puts its 13 pt frame 0.5 pt from the crop's left and top
 * edges.
 */
export default function VisualExpanded() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 14,
        height: 14,
        padding: "0.5px 0 0 0.5px",
        background: "light-dark(#ffffff, #1d1e1f)",
      }}
    >
      <DisclosureTriangle expanded aria-label="Apple" style={{ display: "flex" }} />
    </div>
  );
}
