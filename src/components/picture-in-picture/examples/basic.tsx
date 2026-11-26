import { PictureInPicture } from "macalicious/picture-in-picture";

/** A stand-in for the screen, and a neutral placeholder where the video goes. */
export default function Basic() {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: 240,
        background: "var(--mac-color-window-background)",
      }}
    >
      <PictureInPicture defaultWidth={288}>
        <div style={{ background: "linear-gradient(135deg, #5d6b7a, #2b333d)" }} />
      </PictureInPicture>
    </div>
  );
}
