import { FaceTime } from "../facetime";

/**
 * Visual comparison target: the FaceTime window of both captures, 652 x 585 pt (reference
 * crop, 2x pixels: x=112 y=76 w=1304 h=1170), over the capture's transparent corners (matte
 * white), as captured: All selected, the recipient field empty, no recent calls.
 *
 * One example serves the Aqua and the Dark Aqua capture: the window is the same dark window
 * in both, and they differ only in what shows through the sidebar's material and in the
 * camera's picture. The picture here is the demo's abstract placeholder, not the captured one,
 * and its region, 390 x 585 pt from x 262, is masked out of every comparison.
 */
export default function VisualWindow() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 652,
        height: 585,
        background: "var(--mac-facetime-visual-matte)",
      }}
    >
      <FaceTime style={{ position: "absolute", inset: 0 }} />
    </div>
  );
}
