import { ProgressBar } from "macalicious/progress-bar";

/**
 * Fixture for the states no reference screenshot shows (a window that is not key, another
 * accent). `progress-bar.visual.json` renders it in each state and checks the pixels it
 * expects.
 *
 * 120 x 22 pt on the window background: the 104 x 6 pt bar is at x 8 to 112, y 8 to 14, half
 * full, so the fill is x 8 to 60 and the empty track x 60 to 112.
 */
export default function VisualStates() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 120,
        height: 22,
        padding: 8,
        background: "light-dark(#ececec, #323232)",
      }}
    >
      <ProgressBar value={50} aria-label="Half done" />
    </div>
  );
}
