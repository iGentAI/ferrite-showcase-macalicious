import { Checkbox } from "macalicious/checkbox";

/**
 * Visual comparison target: the two checkboxes at the bottom of System Preferences > General,
 * off above on, without their titles.
 *
 * Reference crop (2x pixels) x=1472 y=1262 w=40 h=88, i.e. 20 x 44 pt, in the Theme-Light and
 * Theme-Dark accent screenshots. The off box is 3 pt from the crop's left edge and 5 pt from
 * its top; the on box is 20 pt below it. The dark captures' window background is #303032
 * because Catalina tints dark windows with the desktop picture; with the graphite accent the
 * tint is off and it is #323232 (see visual-general-graphite).
 */
export default function VisualGeneral() {
  return (
    <div
      style={{
        display: "grid",
        gap: 6,
        alignContent: "start",
        justifyItems: "start",
        boxSizing: "border-box",
        width: 20,
        height: 44,
        padding: "5px 0 0 3px",
        background: "light-dark(#ececec, #303032)",
      }}
    >
      <Checkbox aria-label="Ask to keep changes when closing documents" />
      <Checkbox defaultChecked aria-label="Close windows when quitting an app" />
    </div>
  );
}
