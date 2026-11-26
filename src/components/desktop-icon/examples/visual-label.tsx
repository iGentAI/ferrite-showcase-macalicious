import { DesktopIcon } from "macalicious/desktop-icon";

/**
 * The first desktop icon of the Desktop captures, crop 3130,56,200,180: tile centre 49.5 pt
 * from the crop's left edge and 33.5 pt from its top. The backdrop is the mean of the
 * picture around the icon; the tile is empty, because the volume artwork is Apple's.
 */
export default function VisualLabel() {
  return (
    <div
      style={{
        position: "relative",
        width: 100,
        height: 90,
        overflow: "hidden",
        background:
          "linear-gradient(light-dark(#a5bace, #051b3d), light-dark(#a9c7e2, #041a3d) 18px, light-dark(#a1caed, #041b3e) 36px, light-dark(#99c7ed, #051d40) 54px, light-dark(#9fc8e9, #0a2245))",
      }}
    >
      <DesktopIcon
        icon={null} // Whole points for the layout, the half point as a transform: a browser snaps a
        // layout position to device pixels at 1x and a transform it does not.
        style={{ position: "absolute", left: -9, top: 1, transform: "translate(0.5px, 0.5px)" }}
      >
        Macintosh SSD
      </DesktopIcon>
    </div>
  );
}
