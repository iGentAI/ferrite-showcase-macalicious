import { Box } from "macalicious/box";

/**
 * Visual comparison target: the top edge of the band that crosses System Preferences ›
 * Sharing from one window edge to the other (`edges="horizontal"`). Reference crop (2x pixels)
 * x=280 y=324 w=80 h=40, i.e. 40 x 20 pt: the window background for 10 pt, then the band,
 * whose top border is row 344 of both captures. The band is wider and taller than the crop,
 * which stops above the list inside the band.
 */
export default function VisualBandTop() {
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
        style={{ position: "absolute", left: -10, top: 10, width: 60, height: 60 }}
      />
    </div>
  );
}
