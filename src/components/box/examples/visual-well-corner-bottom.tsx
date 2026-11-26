import { Box } from "macalicious/box";

/**
 * Visual comparison target: the bottom-left corner of the summary box in Activity Monitor's
 * footer (`variant="well"`). Reference crop (2x pixels) x=361 y=1256 w=80 h=70, i.e.
 * 40 x 35 pt, with the corner of the box 5 pt in from the crop's left edge and 30 pt below
 * its top. The crop starts under the last statistic of the first cell.
 */
export default function VisualWellCornerBottom() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 40,
        height: 35,
        background: "light-dark(#ececec, #303133)",
      }}
    >
      <Box
        variant="well"
        aria-label="Summary"
        style={{ position: "absolute", left: 5, bottom: 5, width: 60, height: 60 }}
      />
    </div>
  );
}
