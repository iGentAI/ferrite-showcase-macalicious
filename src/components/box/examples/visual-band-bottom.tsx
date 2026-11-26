import { Box } from "macalicious/box";

/**
 * Visual comparison target: the bottom edge of the band of System Preferences › Sharing
 * (`edges="horizontal"`). Reference crop (2x pixels) x=280 y=970 w=80 h=40, i.e. 40 x 20 pt:
 * the band for 10 pt (its bottom border is row 989 of both captures), then the window
 * background. The band is wider and taller than the crop, which starts below the list inside
 * the band.
 */
export default function VisualBandBottom() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 40,
        height: 20,
        background: "light-dark(#ececec, #2f3031)",
      }}
    >
      <Box
        edges="horizontal"
        aria-label="Band"
        style={{ position: "absolute", left: -10, top: -50, width: 60, height: 60 }}
      />
    </div>
  );
}
