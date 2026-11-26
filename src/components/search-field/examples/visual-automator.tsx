import { SearchField } from "macalicious/search-field";

/**
 * Visual comparison target: the search field of Automator's library, with the keyboard focus
 * the comparison gives it.
 *
 * Reference crop (2x pixels) x=412 y=212 w=456 h=48, that is 228 x 24 pt of the library pane
 * (#e4e4e4, #2f3032) between the toolbar's border and the list below: the field's edge runs
 * x 421 to 856 and y 219 to 254 (218 x 18 pt), 4.5 pt from the crop's left and 3.5 pt from its
 * top, with the focus ring around it. The crop cuts the last half point of the ring.
 *
 * The reference shows no insertion point, and a blinking one would make the capture depend on
 * its timing, so this example hides it: the field takes its insertion point colour from the
 * text colour token, which is made transparent here. An application does not do this.
 */
export default function VisualAutomator() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 228,
        height: 24,
        padding: "3.5px 0 0 4.5px",
        overflow: "hidden",
        lineHeight: 0,
        background: "light-dark(#e4e4e4, #2f3032)",
        ["--mac-color-text" as string]: "transparent",
      }}
    >
      <SearchField variant="sidebar" size="small" placeholder="Name" style={{ width: 218 }} />
    </div>
  );
}
