import { ProgressBar } from "macalicious/progress-bar";

/**
 * Visual comparison target: the trailing, empty end of the bar in Finder's Copy window, alone,
 * so that the rounded end of the track is a large share of the picture and a change of its
 * radius shows in the score. Reference crop (2x pixels) x=820 y=148 w=30 h=30, i.e.
 * 15 x 15 pt: the 307 pt bar comes in from the left, 4.5 pt down, and ends 10 pt in (its last
 * pixel is column 839 in both captures).
 */
export default function VisualTrackEnd() {
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
        value={18}
        max={614}
        aria-label="Copying"
        style={{ position: "absolute", left: -297, top: 4.5, width: 307 }}
      />
    </div>
  );
}
