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
 * Visual comparison target: the QuickTime Player window of the dark capture, which is smaller
 * than the light one, 1346 x 757 pt (reference crop, 2x pixels: x=112 y=76 w=2692 h=1514),
 * and paused further on, at 00:04:40:02. Over the capture's transparent margin (matte white).
 * The controller is centred, its bottom edge 115.5 pt above the window's, as captured.
 *
 * The picture is a flat backdrop (CheckBackdrop, in quicktime-player-check-backdrop.tsx), not the demo's generated movie frame and not
 * the captured movie, so the window as a whole is not compared. The elements marked `data-crop` draw nothing: they are the regions
 * of chrome that are compared with the capture, the left end of the title bar with the window
 * controls and the bar's last point with its two bottom rows.
 */
export default function VisualWindowDark() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 1346,
        height: 757,
        background: "var(--mac-quicktime-player-visual-matte)",
      }}
    >
      <QuickTimePlayer
        poster={<CheckBackdrop />}
        width={1346}
        height={757}
        defaultPosition="00:04:40:02"
        style={
          {
            position: "absolute",
            inset: 0,
            "--mac-quicktime-player-controller-bottom": "115.5px",
          } as CSSProperties
        }
      />
      <div data-crop="window-controls" style={crop(0, 0, 68, 22)} />
      <div data-crop="title-bar-bottom" style={crop(0, 21, 1346, 1)} />
    </div>
  );
}
