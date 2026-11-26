import {
  GradientButton,
  GradientButtonFiller,
  GradientButtonGroup,
} from "macalicious/gradient-button";
import { SystemImage } from "macalicious/system-image";

/**
 * The images are `SystemImage`s here (add, remove, and the action gear with the pull-down
 * chevron 2 pt after it), placed as the gradient button places its own glyphs.
 *
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
        <GradientButton aria-label="Add" style={{ width: 26 }}>
          <SystemImage name="add" />
        </GradientButton>
        <GradientButton aria-label="Remove" style={{ width: 26 }}>
          <SystemImage name="remove" />
        </GradientButton>
        <GradientButton aria-label="Actions">
          <span
            style={{ display: "flex", alignItems: "flex-start", height: 15, marginInlineStart: -2 }}
          >
            <SystemImage name="action" style={{ marginTop: 2 }} />
            <SystemImage name="chevron-down" style={{ margin: "5.5px 0 0 2px" }} />
          </span>
        </GradientButton>
        <GradientButtonFiller />
      </GradientButtonGroup>
    </div>
  );
}
