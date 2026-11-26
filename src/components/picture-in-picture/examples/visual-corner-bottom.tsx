import { PictureInPicture } from "macalicious/picture-in-picture";

/**
 * Visual comparison target: the bottom-right corner of the window and the shadow under and
 * beside it, over the desktop.
 *
 * Reference crop x=3260 y=652 w=100 h=100 (50 x 50 pt) of the Safari-v13-Picture-in-Picture
 * captures: the window's corner is 30 pt from the crop's left edge and 13 pt from its top.
 * The rest is the desktop picture's sea: the background is a colour ramp fitted to the same
 * rows of the Desktop captures, not the picture, so the picture's grain remains as a
 * difference. The video frame is masked.
 */
export default function VisualCornerBottom() {
  return (
    <div
      style={{
        position: "relative",
        width: 50,
        height: 50,
        overflow: "hidden",
        background: `linear-gradient(${SEA})`,
      }}
    >
      {/* The screen under the menu bar. */}
      <div style={{ position: "absolute", left: -1630, top: -304, width: 1680, height: 1028 }}>
        <PictureInPicture width={528}>
          <div style={{ background: "#a8967a" }} />
        </PictureInPicture>
      </div>
    </div>
  );
}

const SEA = [
  "light-dark(#81b7da, #234269)",
  "light-dark(#81b4d6, #1f3d64)",
  "light-dark(#7fb0d1, #1b3a60)",
  "light-dark(#80afcd, #19385f)",
  "light-dark(#83aeca, #1b3a61)",
  "light-dark(#81a9c4, #19385e)",
  "light-dark(#82a9c2, #17375c)",
  "light-dark(#86a8c2, #17365b)",
  "light-dark(#89a8c1, #18385d)",
  "light-dark(#7fa1ba, #19385d)",
  "light-dark(#87a5be, #18385d)",
].join(", ");
