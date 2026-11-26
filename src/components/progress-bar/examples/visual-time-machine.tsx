import { ProgressBar } from "macalicious/progress-bar";

/**
 * Visual comparison target: the backup progress bar of System Preferences › Time Machine,
 * which lies on a box (#e3e3e3). Reference crop (2x pixels) x=904 y=344 w=418 h=30, i.e.
 * 209 x 15 pt, with the 199 x 6 pt bar 5 pt from the left and 4.5 pt from the top. The fill
 * ends at x=1169.5: 255.5 of the bar's 398 device pixels. Only the Aqua capture shows a backup
 * in progress.
 */
export default function VisualTimeMachine() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 209,
        height: 15,
        padding: "4.5px 5px 0",
        background: "light-dark(#e3e3e3, #363637)",
      }}
    >
      <ProgressBar value={255.5} max={398} aria-label="Backing up" />
    </div>
  );
}
