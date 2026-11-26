import { LockButton } from "macalicious/lock-button";

/**
 * Visual comparison target: the small closed lock at the bottom right of Finder's Info window
 * (#ececec in Aqua, #323437 in Dark Aqua).
 *
 * Reference crop (2x pixels) x=560 y=1704 w=76 h=56, i.e. 38 x 28 pt, with nothing else in it.
 * The padlock's artwork spans x 581 to 606 and y 1712 to 1743 (13 x 16 pt), so it starts
 * 10.5 pt from the crop's left edge and 4 pt from its top. The padlock is substitute artwork:
 * what the comparison holds is its box and its place.
 */
export default function VisualInfoLock() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 38,
        height: 28,
        padding: "4px 0 0 10.5px",
        background: "light-dark(#ececec, #323437)",
      }}
    >
      <LockButton size="small" style={{ display: "flex" }} />
    </div>
  );
}
