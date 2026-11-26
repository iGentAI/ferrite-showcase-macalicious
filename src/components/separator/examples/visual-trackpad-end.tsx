import { Separator } from "macalicious/separator";

/**
 * Visual comparison target: the right end of the separator above the sliders of System
 * Preferences › Trackpad, on the pane's box. The line is at x=190..763, y=608..609 in the
 * capture. Reference crop (2x pixels) x=750 y=598 w=24 h=22, i.e. 12 x 11 pt, close around
 * the end so that the few pixels of a rounded end are a countable share of it: the line comes
 * in from the left, 5 pt down, and ends 7 pt in, 5 pt before the crop's right edge.
 */
export default function VisualTrackpadEnd() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 12,
        height: 11,
        paddingTop: 5,
        background: "light-dark(#e3e3e3, #363637)",
      }}
    >
      <Separator style={{ width: 7 }} />
    </div>
  );
}
