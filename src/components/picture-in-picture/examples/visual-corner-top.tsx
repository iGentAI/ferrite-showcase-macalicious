import { PictureInPicture } from "macalicious/picture-in-picture";

/**
 * Visual comparison target: the top-right corner of the window over the desktop.
 *
 * Reference crop x=3280 y=48 w=80 h=96 (40 x 48 pt) of the Safari-v13-Picture-in-Picture
 * captures: the window is 528 x 297 pt, 20 pt from the right edge of the 1680 pt screen and
 * 20 pt under the 22 pt menu bar, so its corner is 20 pt from the crop's left edge and 18 pt
 * from its top. Its shadow falls on the desktop picture's sky, which is smooth here: the
 * background is a colour ramp fitted to the same rows of the Desktop captures, not the
 * picture. The video is a flat stand-in of the frame's colour near this corner; the
 * comparison masks it except for the 4 pt square at the corner.
 */
export default function VisualCornerTop() {
  return (
    <div
      style={{
        position: "relative",
        width: 40,
        height: 48,
        overflow: "hidden",
        background: `linear-gradient(${SKY})`,
      }}
    >
      {/* The screen under the menu bar. */}
      <div style={{ position: "absolute", left: -1640, top: -2, width: 1680, height: 1028 }}>
        <PictureInPicture width={528}>
          <div style={{ background: "#211f19" }} />
        </PictureInPicture>
      </div>
    </div>
  );
}

const SKY = [
  "light-dark(#a0b5ca, #031839)",
  "light-dark(#a1b8ce, #03183a)",
  "light-dark(#a3bbd2, #03183a)",
  "light-dark(#a3bed6, #03183b)",
  "light-dark(#a4c1db, #03183b)",
  "light-dark(#a2c4e0, #03193b)",
  "light-dark(#a0c5e3, #03193c)",
  "light-dark(#a3c9e8, #03193c)",
  "light-dark(#9ec9ea, #03193c)",
  "light-dark(#9fcaed, #03193c)",
  "light-dark(#9ac8ed, #031a3c)",
  "light-dark(#9bc9ed, #031a3c)",
  "light-dark(#9ac9ee, #041b3d)",
].join(", ");
