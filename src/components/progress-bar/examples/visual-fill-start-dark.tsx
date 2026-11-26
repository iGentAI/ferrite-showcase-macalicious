import { ProgressBar } from "macalicious/progress-bar";

/**
 * Visual comparison target: the leading, filled end of the bar of Finder's Copy window in the
 * Dark Aqua capture, alone, so that the rounded end of the fill is a large share of the
 * picture. Reference crop (2x pixels) x=216 y=148 w=30 h=30, i.e. 15 x 15 pt: the 307 pt bar
 * starts 5 pt in (its first pixel is column 226), 4.5 pt down, and runs out of the crop on the
 * right. The fill ends at x=274, beyond the crop.
 */
export default function VisualFillStartDark() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 15,
        height: 15,
        background: "light-dark(#ececec, #2e3235)",
      }}
    >
      <ProgressBar
        value={48.5}
        max={614}
        aria-label="Copying"
        style={{ position: "absolute", left: 5, top: 4.5, width: 307 }}
      />
    </div>
  );
}
