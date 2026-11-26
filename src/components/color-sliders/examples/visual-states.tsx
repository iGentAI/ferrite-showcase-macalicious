import { ColorSliders } from "macalicious/color-sliders";

/**
 * Fixture for the pixel checks in `color-sliders.visual.json`: no screenshot shows the Colors
 * panel, so the checks hold the picker's sliders to the colour it is given, with the track and
 * field colours measured on the library's slider and text field.
 *
 * A 240 x 200 pt box of the window background. The picker is 200 pt wide at 20, 20 and holds
 * Tangerine (#ff9300): red at its maximum, green at 147 of 255, blue at 0.
 */
export default function VisualStates() {
  return (
    <div
      style={{
        position: "relative",
        width: 240,
        height: 200,
        overflow: "hidden",
        background: "light-dark(#ececec, #323232)",
      }}
    >
      <ColorSliders defaultValue="#ff9300" style={{ position: "absolute", left: 20, top: 20 }} />
    </div>
  );
}
