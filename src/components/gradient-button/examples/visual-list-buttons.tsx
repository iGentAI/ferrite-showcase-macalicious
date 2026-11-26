import {
  GradientButton,
  GradientButtonFiller,
  GradientButtonGroup,
} from "macalicious/gradient-button";

/**
 * Visual comparison target: the add and remove buttons under the Preferred languages list of
 * the Language & Region preference pane. Add is enabled, remove is disabled, and a filler cell
 * continues to the right.
 *
 * Reference crop (2x pixels) x=184 y=884 w=114 h=58, i.e. 57 x 29 pt. The bar's outer border
 * starts at x=192, y=892, 4 pt from the crop's left and top edges; the cells' fills are 23 pt
 * wide. Above the bar is the list (white in Aqua, #1d1e1f in Dark Aqua) with its own left
 * border, and everything sits in a box (#e3e3e3, #363637). The list is not part of the
 * component, so it is drawn here with plain styles.
 */
export default function VisualListButtons() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 57,
        height: 29,
        paddingLeft: 4,
        overflow: "hidden",
        background: "light-dark(#e3e3e3, #363637)",
      }}
    >
      <div
        style={{
          boxSizing: "border-box",
          height: 4,
          borderLeft: "1px solid light-dark(#aaaaaa, #808080)",
          background: "light-dark(#ffffff, #1d1e1f)",
        }}
      />
      <GradientButtonGroup style={{ display: "flex", width: 120 }}>
        <GradientButton glyph="add" aria-label="Add" />
        <GradientButton glyph="remove" aria-label="Remove" disabled />
        <GradientButtonFiller />
      </GradientButtonGroup>
    </div>
  );
}
