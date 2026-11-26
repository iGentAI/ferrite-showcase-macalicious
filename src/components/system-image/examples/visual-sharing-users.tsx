import { SystemImage } from "macalicious/system-image";

/**
 * Visual comparison target: the three images in the Users table of System Preferences >
 * Sharing: one user, a group and everyone.
 *
 * Reference crop (2x pixels) x=932 y=622 w=36 h=114, i.e. 18 x 57 pt of the table's
 * background. The user is 13 x 13 pt, 2 pt from the crop's left edge and 2 pt from its top;
 * the group and everyone are 15 x 10.5 pt, 1 pt from the left, 24 pt and 42.5 pt from the top.
 * The table draws them in black in Aqua and in a light grey in Dark Aqua.
 */
export default function VisualSharingUsers() {
  return (
    <div
      style={{
        position: "relative",
        width: 18,
        height: 57,
        color: "light-dark(#000000, #e6e6e6)",
        background: "light-dark(#ffffff, #1d1e1f)",
      }}
    >
      <SystemImage name="user" style={{ position: "absolute", left: 2, top: 2 }} />
      <SystemImage name="user-group" style={{ position: "absolute", left: 1, top: 24 }} />
      <SystemImage name="everyone" style={{ position: "absolute", left: 1, top: 42.5 }} />
    </div>
  );
}
