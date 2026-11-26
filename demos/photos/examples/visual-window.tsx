import type { CSSProperties } from "react";
import { Photos } from "../photos";

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
 * Visual comparison target: the whole Photos window of the captures, on the Wallpapers album
 * with nothing selected. Reference crop (2x pixels) x=112 y=76 w=2400 h=1440, i.e. the
 * 1200 x 720 pt frame, over the capture's transparent margin (matte white).
 *
 * The 17 pictures and the album's thumbnail in the sidebar are the demo's abstract
 * placeholders, not the captured pictures: every comparison masks them. The elements marked
 * `data-crop` draw nothing: they are the regions of chrome that are compared on their own,
 * the toolbar, the sidebar and the album's header.
 */
export default function VisualWindow() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 1200,
        height: 720,
        background: "#ffffff",
      }}
    >
      <Photos style={{ position: "absolute", inset: 0 }} />
      <div data-crop="toolbar" style={crop(0, 0, 1200, 38)} />
      <div data-crop="sidebar" style={crop(0, 38, 180, 682)} />
      <div data-crop="header" style={crop(180, 38, 1020, 75)} />
    </div>
  );
}
