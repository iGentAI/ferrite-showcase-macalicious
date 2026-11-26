import { Checkbox } from "macalicious/checkbox";

/**
 * Visual comparison target: the mixed checkbox of System Preferences > Software Update, without
 * its title.
 *
 * Reference crop (2x pixels) x=574 y=564 w=44 h=44, i.e. 22 x 22 pt, with the 14 pt box 4 pt
 * from the crop's left and top edges. It sits on a group box, #e3e3e3 in Aqua and #363637 in
 * Dark Aqua.
 */
export default function VisualMixed() {
  return (
    <div
      style={{
        display: "flex",
        boxSizing: "border-box",
        width: 22,
        height: 22,
        padding: "4px 0 0 4px",
        background: "light-dark(#e3e3e3, #363637)",
      }}
    >
      <Checkbox indeterminate aria-label="Automatically keep my Mac up to date" />
    </div>
  );
}
