import { Box } from "macalicious/box";

/**
 * Visual comparison target: the top-left corner of the box in System Preferences › Sound, a
 * plain box on the window background. Reference crop (2x pixels) x=132 y=192 w=80 h=80, i.e.
 * 40 x 40 pt, with the corner of the box 10 pt in from the crop's corner. The box is larger
 * than the crop and is cut off by it.
 */
export default function VisualCornerTop() {
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
        style={{ position: "absolute", left: 10, top: 10, width: 60, height: 60 }}
      />
    </div>
  );
}
