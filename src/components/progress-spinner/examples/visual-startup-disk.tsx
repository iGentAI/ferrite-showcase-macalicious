import { ProgressSpinner } from "macalicious/progress-spinner";

/**
 * Visual comparison target: the small spinner at the top right of System Preferences ›
 * Startup Disk (Dark Aqua). Reference crop (2x pixels) x=1364 y=180 w=48 h=48, i.e. 24 x 24 pt
 * with the 16 pt spinner at (4, 4) pt. The capture caught the frame whose head is at
 * 3 o'clock; the example shows a stopped spinner turned by a quarter.
 */
export default function VisualStartupDisk() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 24,
        height: 24,
        padding: 4,
        background: "light-dark(#e6e7e7, #303031)",
      }}
    >
      <ProgressSpinner
        size="small"
        animating={false}
        displayedWhenStopped
        aria-label="Loading"
        style={{ display: "block", rotate: "90deg" }}
      />
    </div>
  );
}
