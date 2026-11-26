import { Box } from "macalicious/box";

/**
 * Visual comparison target: the top-left corner of the summary box in Activity Monitor's
 * footer (`variant="well"`), on the footer's background. Reference crop (2x pixels) x=361
 * y=1126 w=28 h=56, i.e. 14 x 28 pt, with the corner of the box 5 pt in from the crop's
 * corner. The crop ends before the first statistic's text and above the first row rule.
 */
export default function VisualWellCornerTop() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 14,
        height: 28,
        background: "light-dark(#ececec, #303133)",
      }}
    >
      <Box
        variant="well"
        aria-label="Summary"
        style={{ position: "absolute", left: 5, top: 5, width: 60, height: 60 }}
      />
    </div>
  );
}
