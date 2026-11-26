import type { CSSProperties } from "react";
import { FindMy } from "../find-my";

/** A box that draws nothing: the region of the window that one comparison captures. */
const crop = (left: number, top: number, width: number, height: number): CSSProperties => ({
  position: "absolute",
  left,
  top,
  width,
  height,
  pointerEvents: "none",
});

/**
 * Visual comparison target: the Find My window of the Dark Aqua capture, which was taken
 * while another window was key: its window controls are grey. The window is given that state,
 * as a window manager would give it. Reference crop (2x pixels) x=68 y=52 w=2270 h=1446, i.e.
 * the 1135 x 723 pt frame, over the capture's transparent margin (matte white).
 *
 * The map is the demo's abstract placeholder: every comparison masks it. The elements marked
 * `data-crop` draw nothing: they are the regions that are compared, as in `visual-window`.
 */
export default function VisualWindowDark() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 1135,
        height: 723,
        background: "#ffffff",
      }}
    >
      <FindMy state="inactive" style={{ position: "absolute", inset: 0 }} />
      <div data-crop="sidebar" style={crop(0, 0, 262, 723)} />
      <div data-crop="bottom" style={crop(0, 620, 1135, 103)} />
    </div>
  );
}
