import { Box } from "macalicious/box";

/**
 * Visual comparison target: the bottom-left corner of the box in System Preferences ›
 * Sound. Reference crop (2x pixels) x=132 y=840 w=80 h=80, i.e. 40 x 40 pt, with the
 * corner of the box 10 pt in from the crop's left edge and 30 pt below its top.
 */
export default function VisualCornerBottom() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 40,
        height: 40,
        background: "light-dark(#ececec, #2f3031)",
      }}
    >
      <Box
        aria-label="Box"
        style={{ position: "absolute", left: 10, bottom: 10, width: 60, height: 60 }}
      />
    </div>
  );
}
