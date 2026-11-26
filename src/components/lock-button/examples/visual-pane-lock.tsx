import { LockButton } from "macalicious/lock-button";

/**
 * Visual comparison target: the closed lock and its text at the foot of the Date & Time
 * preference pane (#ececec in Aqua, #2f3031 in Dark Aqua).
 *
 * Reference crop (2x pixels) x=152 y=1032 w=476 h=72, i.e. 238 x 36 pt. The padlock's artwork
 * spans x 163 to 206 and y 1041 to 1095, so it starts 5.5 pt from the crop's left edge and
 * 4.5 pt from its top; the text's ink starts at x=235.
 */
export default function VisualPaneLock() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 238,
        height: 36,
        padding: "4.5px 0 0 5.5px",
        background: "light-dark(#ececec, #2f3031)",
      }}
    >
      <LockButton style={{ display: "flex" }} />
    </div>
  );
}
