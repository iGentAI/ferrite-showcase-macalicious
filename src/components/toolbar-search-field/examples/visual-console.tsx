import { ToolbarSearchField } from "macalicious/toolbar-search-field";

/**
 * Visual comparison target: the leading end of Console's search field, the bright variant.
 *
 * Reference crop (2x pixels) x=926 y=118 w=400 h=60, i.e. 200 x 30 pt, 407 pt right of and
 * 21 pt below the window's top-left corner. The field's fill starts 413 pt from the window's
 * edge and 25 pt below its top, on Console's 68 pt chrome (67 pt of bar over its last row),
 * and runs past the crop.
 *
 * The backdrop is the capture's own bar (column 730, y=78 and y=209), not the library's title
 * bar material: the dark Console window is seven levels lighter than that material, and the
 * dark bezel is translucent, so its fill follows the bar.
 */
export default function VisualConsole() {
  return (
    <div style={{ position: "relative", width: 200, height: 30, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: "-21px 0 auto",
          height: 67,
          background: "linear-gradient(light-dark(#e4e4e4, #474849), light-dark(#d0d1d1, #3c3d3e))",
        }}
      />
      <ToolbarSearchField
        variant="bright"
        style={{ position: "absolute", left: 6, top: 4, width: 579 }}
      />
    </div>
  );
}
