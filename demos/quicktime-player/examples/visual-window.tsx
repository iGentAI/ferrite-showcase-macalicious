import type { CSSProperties } from "react";
import { QuickTimePlayer } from "../quicktime-player";
import { CheckBackdrop } from "../quicktime-player-check-backdrop";

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
 * Visual comparison target: the QuickTime Player window of the light capture, 1470 x 827 pt
 * (reference crop, 2x pixels: x=112 y=76 w=2940 h=1654), over the capture's transparent
 * margin (matte white), paused at 00:03:16:12 of 00:12:49:22 with the volume at its maximum
 * and the controller shown. The controller is where the capture has it: half a point right of
 * the centre, its bottom edge 127.5 pt above the window's.
 *
 * The picture is a flat backdrop (CheckBackdrop, in quicktime-player-check-backdrop.tsx), not the demo's generated movie frame and not
 * the captured movie, so the window as a whole is not compared. The elements marked `data-crop` draw nothing: they are the regions
 * of chrome that are compared with the capture, the left end of the title bar with the window
 * controls and the bar's last point with its two bottom rows.
 */
export default function VisualWindow() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 1470,
        height: 827,
        background: "var(--mac-quicktime-player-visual-matte)",
      }}
    >
      <QuickTimePlayer
        poster={<CheckBackdrop />}
        defaultPosition="00:03:16:12"
        style={
          {
            position: "absolute",
            inset: 0,
            "--mac-quicktime-player-controller-bottom": "127.5px",
            "--mac-quicktime-player-controller-shift": "0.5px",
          } as CSSProperties
        }
      />
      <div data-crop="window-controls" style={crop(0, 0, 68, 22)} />
      <div data-crop="title-bar-bottom" style={crop(0, 21, 1470, 1)} />
    </div>
  );
}
