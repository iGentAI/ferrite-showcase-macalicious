import { MenuItem } from "macalicious/menu-item";
import { PullDownButton } from "macalicious/pull-down-button";

/**
 * Visual comparison target: the enabled small pull-down button without a bezel under
 * "Secondary click" in the Trackpad preference pane.
 *
 * Reference crop (2x pixels) x=236 y=416 w=270 h=32 in both Trackpad screenshots, i.e. 135 x
 * 16 pt. The title's ink starts 3.5 pt from the crop's left edge and its chevron's ink ends
 * 7 pt before the right edge; the width pins the chevron there, whatever the font. The crop is
 * 16 pt high where the small button is 19 pt, so the button starts 1.5 pt above it. The row
 * behind is selected in Aqua and plain in Dark Aqua.
 */
export default function VisualBorderless() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 135,
        height: 16,
        paddingLeft: 3,
        background: "light-dark(#f0f0f0, #363636)",
      }}
    >
      <PullDownButton
        size="small"
        bordered={false}
        title="Click with two fingers"
        style={{ width: 127, marginTop: -1.5 }}
      >
        <MenuItem>Click with two fingers</MenuItem>
        <MenuItem>Click in bottom right corner</MenuItem>
        <MenuItem>Click in bottom left corner</MenuItem>
      </PullDownButton>
    </div>
  );
}
