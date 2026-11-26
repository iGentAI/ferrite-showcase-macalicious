import { Slider } from "macalicious/slider";

/**
 * Visual comparison target: the Tracking speed slider of the Mouse pane, a regular slider
 * with ten tick marks, the thumb on the fourth.
 *
 * Reference crop (2x pixels) x=290 y=690 w=306 h=54, i.e. 153 x 27 pt. The track runs from
 * x=299 to 586 (144 pt) at y 706 to 711, 4.5 pt from the crop's left edge; the thumb's fill
 * starts at y=698, 4 pt below the crop's top.
 */
export default function VisualMouse() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 153,
        height: 27,
        padding: "4px 4.5px 0",
        background: "light-dark(#e3e3e3, #363637)",
      }}
    >
      <Slider
        aria-label="Tracking speed"
        tickMarks={10}
        tickMarkValuesOnly
        max={9}
        defaultValue={3}
      />
    </div>
  );
}
