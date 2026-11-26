import { PictureInPicture } from "macalicious/picture-in-picture";

/**
 * Visual state target: a 320 x 180 pt window in the top-right corner of a 400 x 260 pt screen,
 * over a flat grey stand-in for the video, so that the scrim and the controls can be read.
 * The state checks hover it, focus its buttons, and move and resize it with the keyboard.
 */
export default function VisualControls() {
  return (
    <div
      style={{
        position: "relative",
        width: 400,
        height: 260,
        overflow: "hidden",
        background: "light-dark(#ececec, #323232)",
      }}
    >
      <PictureInPicture defaultWidth={320} minWidth={160}>
        <div style={{ background: "#808080" }} />
      </PictureInPicture>
    </div>
  );
}
