import { Box } from "macalicious/box";
import type { CSSProperties } from "react";

/**
 * Visual comparison target: the top-left corner of the information table of Disk Utility, a
 * rounded well whose line is the app's own colour, not Activity Monitor's. Reference crop
 * (2x pixels) x=674 y=718 w=28 h=56, i.e. 14 x 28 pt, with the corner of the box 5 pt in from
 * the crop's corner (its edge is x=684, y=728). The line's colour is set through the well's
 * token, as an application would set it.
 */
export default function VisualWellCornerDiskUtility() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 14,
        height: 28,
        background: "light-dark(#ececec, #303132)",
      }}
    >
      <Box
        variant="well"
        aria-label="Information"
        style={
          {
            position: "absolute",
            left: 5,
            top: 5,
            width: 60,
            height: 60,
            "--mac-box-well-border": "light-dark(#d1d1d1, #808080)",
          } as CSSProperties
        }
      />
    </div>
  );
}
