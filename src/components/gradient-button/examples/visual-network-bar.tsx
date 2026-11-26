import {
  GradientButton,
  GradientButtonFiller,
  GradientButtonGroup,
} from "macalicious/gradient-button";

/**
 * Visual comparison target: the bar under the services list of the Network preference pane,
 * drawn with the group's `network` variant, which holds that pane's own colours.
 *
 * The same box as `visual-action-bar`: reference crop (2x pixels) x=144 y=1024 w=180 h=58,
 * i.e. 90 x 29 pt, the bar's outer border 4 pt from the crop's left and top edges, add and
 * remove with 24 pt of fill and the action cell with 28 pt. Above the bar is the list (white
 * in Aqua, #1d1e1f in Dark Aqua) with its own left border, on the window background (#ececec,
 * #2f3031); the list is not part of the component and is drawn here with plain styles.
 */
export default function VisualNetworkBar() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 90,
        height: 29,
        paddingLeft: 4,
        overflow: "hidden",
        background: "light-dark(#ececec, #2f3031)",
      }}
    >
      <div
        style={{
          boxSizing: "border-box",
          height: 4,
          borderLeft: "1px solid light-dark(#c5c5c5, #565656)",
          background: "light-dark(#ffffff, #1d1e1f)",
        }}
      />
      <GradientButtonGroup variant="network" style={{ display: "flex", width: 140 }}>
        <GradientButton glyph="add" aria-label="Add" style={{ width: 26 }} />
        <GradientButton glyph="remove" aria-label="Remove" style={{ width: 26 }} />
        <GradientButton glyph="action" aria-label="Actions" />
        <GradientButtonFiller />
      </GradientButtonGroup>
    </div>
  );
}
