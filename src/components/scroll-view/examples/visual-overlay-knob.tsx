import { ScrollView } from "macalicious/scroll-view";

/**
 * Visual comparison target: the overlay knob at full strength over the light page of the
 * Safari window in 10-15-Catalina-Dark-Safari-v13-Picture-in-Picture.png. Reference crop (2x
 * pixels) x=2792 y=740 w=60 h=100, i.e. 30 x 50 pt ending at the page's trailing edge, below
 * the shadow the page header casts on the knob's upper part. The knob is 75 pt long and ends
 * 44 pt below the crop's top.
 *
 * The scroll view is 200 pt tall and starts 33 pt above the crop's top, so that its knob,
 * 2 pt inside the track, starts at -31 pt; the content height makes the knob 75 of the
 * track's 196 pt. `data-force` shows the knob without scrolling.
 */
export default function VisualOverlayKnob() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 30,
        height: 50,
        background: "#fafafa",
      }}
    >
      <ScrollView
        knobStyle="dark"
        data-force="scrolling"
        style={{ position: "absolute", top: -33, left: 0, width: 30, height: 200 }}
      >
        <div style={{ height: (200 * 196) / 75 }} />
      </ScrollView>
    </div>
  );
}
