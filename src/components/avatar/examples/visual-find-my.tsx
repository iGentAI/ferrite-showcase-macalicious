import { Avatar } from "macalicious/avatar";

/**
 * Visual comparison target: the disc of "Me" in Find My's People list, 36 x 36 pt of the
 * sidebar from 8 pt inside the window's leading edge and 82 pt under its top edge, with the
 * disc at 28.75 pt, 3.375 pt in and 3.875 pt down (its centre is at 25.75, 100.25 pt in the
 * window): the placement that scores best against both captures.
 *
 * Reference crop (2x pixels) w=72 h=72: x=128 y=240 in the Aqua capture, x=84 y=216 in the
 * Dark Aqua one. The background is the sidebar's colour in those captures (Light @ 128,240,
 * Dark @ 84,216). The silhouette is the library's own drawing, compared unmasked: its head
 * and shoulders are placed and sized where the capture has them.
 */
export default function VisualFindMy() {
  return (
    <div
      style={{
        position: "relative",
        width: 36,
        height: 36,
        background: "light-dark(#f6f6f4, #202124)",
      }}
    >
      <Avatar alt="Me" size={28.75} style={{ position: "absolute", left: 3.375, top: 3.875 }} />
    </div>
  );
}
