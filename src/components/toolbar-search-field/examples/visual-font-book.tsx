import { ToolbarSearchField, ToolbarSearchFieldMenuButton } from "macalicious/toolbar-search-field";

/**
 * Visual comparison target: the leading end of Font Book's search field, whose magnifier is a
 * search menu button.
 *
 * Reference crop (2x pixels) x=1276 y=118 w=400 h=60, i.e. 200 x 30 pt, 21 pt below the
 * window's top. The field's fill starts 6 pt inside the crop and 25 pt below the window's top,
 * on the 55 pt unified bar (54 pt over its last row), and is 420.5 pt wide.
 *
 * The backdrop is the capture's own bar (column 1270, y=78 and y=183): the dark Font Book
 * window is three levels lighter than the library's title bar material, and the dark bezel is
 * translucent, so its fill follows the bar.
 */
export default function VisualFontBook() {
  return (
    <div style={{ position: "relative", width: 200, height: 30, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: "-21px 0 auto",
          height: 54,
          background: "linear-gradient(light-dark(#e6e6e6, #444447), light-dark(#cdcdcd, #373739))",
        }}
      />
      <ToolbarSearchField
        style={{ position: "absolute", left: 6, top: 4, width: 420.5 }}
        searchMenu={<ToolbarSearchFieldMenuButton aria-label="Search in" />}
      />
    </div>
  );
}
