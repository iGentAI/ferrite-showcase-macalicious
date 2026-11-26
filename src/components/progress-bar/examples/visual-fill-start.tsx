import { ProgressBar } from "macalicious/progress-bar";

/**
 * Visual comparison target: the leading, filled end of the backup bar of System Preferences ›
 * Time Machine, alone, so that the rounded end of the fill is a large share of the picture.
 * Reference crop (2x pixels) x=904 y=344 w=30 h=30, i.e. 15 x 15 pt: the bar starts 5 pt in
 * (its first pixel is column 914), 4.5 pt down, and runs out of the crop on the right.
 */
export default function VisualFillStart() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 15,
        height: 15,
        background: "light-dark(#e3e3e3, #363637)",
      }}
    >
      <ProgressBar
        value={255.5}
        max={398}
        aria-label="Backing up"
        style={{ position: "absolute", left: 5, top: 4.5, width: 199 }}
      />
    </div>
  );
}
