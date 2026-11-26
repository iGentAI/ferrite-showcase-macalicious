import { PushButton } from "macalicious/push-button";

/**
 * Visual comparison target: the button row of Finder's "Go to Folder" dialog.
 *
 * Reference crop (2x pixels) x=540 y=270 w=420 h=76, i.e. 210 x 38 pt. In the capture both
 * buttons are 84 pt wide, 12 pt apart, and start 15 pt from the crop's left edge and 8 pt from
 * its top. The dark capture's dialog background is #303031 rather than the catalog window
 * colour because Catalina tints dark windows with the desktop picture.
 */
export default function VisualDialogButtons() {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        boxSizing: "border-box",
        width: 210,
        height: 38,
        padding: "8px 0 0 15px",
        background: "light-dark(#ececec, #303031)",
      }}
    >
      <PushButton style={{ width: 84 }}>Cancel</PushButton>
      <PushButton variant="primary" style={{ width: 84 }}>
        Go
      </PushButton>
    </div>
  );
}
