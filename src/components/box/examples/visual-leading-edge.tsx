import { Box } from "macalicious/box";

/**
 * Visual comparison target: the leading edge of the detail region of System Preferences ›
 * Time Machine, which has a border on that side only (`edges="leading"`). Reference crop
 * (2x pixels) x=550 y=300 w=80 h=80, i.e. 40 x 40 pt: the window background for 10 pt, then
 * the region, whose border is column 570 of both captures. The region is larger than the crop.
 */
export default function VisualLeadingEdge() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 40,
        height: 40,
        background: "light-dark(#ececec, #303031)",
      }}
    >
      <Box
        edges="leading"
        aria-label="Detail"
        style={{ position: "absolute", left: 10, top: -10, width: 60, height: 60 }}
      />
    </div>
  );
}
