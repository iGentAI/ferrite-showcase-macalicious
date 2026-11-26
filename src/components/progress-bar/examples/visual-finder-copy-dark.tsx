import { ProgressBar } from "macalicious/progress-bar";

/**
 * Visual comparison target: the progress bar of Finder's Copy window in the Dark Aqua capture,
 * which is further along than the Aqua one. Reference crop (2x pixels) x=216 y=148 w=634 h=30,
 * i.e. 317 x 15 pt, with the 307 x 6 pt bar 5 pt from the left and 4.5 pt from the top. The
 * fill ends at x=274: 48.5 of the bar's 614 device pixels.
 */
export default function VisualFinderCopyDark() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 317,
        height: 15,
        padding: "4.5px 5px 0",
        background: "light-dark(#ececec, #2e3235)",
      }}
    >
      <ProgressBar value={48.5} max={614} aria-label="Copying" />
    </div>
  );
}
