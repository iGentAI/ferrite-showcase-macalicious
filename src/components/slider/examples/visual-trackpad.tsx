import { Slider } from "macalicious/slider";

/**
 * Visual comparison target: the Click and Tracking speed sliders of the Trackpad pane, small
 * sliders with three and ten tick marks, the thumbs on the second and the fourth mark.
 *
 * Reference crop (2x pixels) x=220 y=674 w=528 h=40, i.e. 264 x 20 pt. The tracks run from
 * x=228 to 431 and from x=536 to 739 (102 pt each) at y 688 to 693; the thumbs' fills start
 * at y=682, 4 pt below the crop's top.
 */
export default function VisualTrackpad() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        display: "flex",
        gap: 52,
        width: 264,
        height: 20,
        padding: "4px 0 0 4px",
        background: "light-dark(#e3e3e3, #363637)",
      }}
    >
      <Slider
        aria-label="Click"
        size="small"
        tickMarks={3}
        tickMarkValuesOnly
        max={2}
        defaultValue={1}
        style={{ width: 102 }}
      />
      <Slider
        aria-label="Tracking speed"
        size="small"
        tickMarks={10}
        tickMarkValuesOnly
        max={9}
        defaultValue={3}
        style={{ width: 102 }}
      />
    </div>
  );
}
