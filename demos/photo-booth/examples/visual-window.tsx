import type { CSSProperties } from "react";
import { PhotoBooth } from "../photo-booth";
import { EFFECT_PAGES } from "../photo-booth-data";

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
 * Visual comparison target: the Photo Booth window of the two captures, 720 x 562 pt
 * (reference crop, 2x pixels: x=112 y=76 w=1440 h=1124), over the capture's transparent margin
 * (matte white), with the Effects browser on its second page. The captures have three pages,
 * without the backdrops, so the page control is compared with three dots.
 *
 * The nine previews are four fifths of the window and show the camera in the captures, where
 * the demo shows an abstract placeholder, so the window as a whole is not compared. The
 * elements marked `data-crop` draw nothing: they are the regions of chrome that are compared
 * with the captures, the title bar with the stage's top edge and the bar with the stage's
 * bottom edge.
 */
export default function VisualWindow() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 720,
        height: 562,
        background: "var(--mac-photo-booth-visual-matte)",
      }}
    >
      <PhotoBooth
        effectPages={EFFECT_PAGES.slice(0, 3)}
        style={{ position: "absolute", inset: 0 }}
      />
      <div data-crop="title-bar" style={crop(0, 0, 720, 25)} />
      <div data-crop="bar" style={crop(0, 499, 720, 63)} />
    </div>
  );
}
