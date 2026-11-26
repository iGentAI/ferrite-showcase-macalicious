import { PictureInPicture } from "macalicious/picture-in-picture";
import { PushButton } from "macalicious/push-button";
import { useState } from "react";

type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

/**
 * Everything held by the caller: whether the window is open, where it sits, how wide it is and
 * whether the video plays. The page's own player would show its placeholder while `open`.
 */
export default function Controlled() {
  const [open, setOpen] = useState(true);
  const [corner, setCorner] = useState<Corner>("bottom-right");
  const [width, setWidth] = useState(256);
  const [playing, setPlaying] = useState(false);
  const [returned, setReturned] = useState(false);
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: 300,
        padding: 20,
        boxSizing: "border-box",
        background: "var(--mac-color-window-background)",
        color: "var(--mac-color-label)",
        font: "var(--mac-font-body)",
      }}
    >
      <p style={{ margin: "0 0 12px" }}>
        {open
          ? `${playing ? "Playing" : "Paused"} in the ${corner} corner, ${width} points wide.`
          : returned
            ? "The video is back in its page."
            : "The video is closed."}
      </p>
      <PushButton
        disabled={open}
        onClick={() => {
          setReturned(false);
          setOpen(true);
        }}
      >
        Enter Picture in Picture
      </PushButton>
      <PictureInPicture
        open={open}
        onOpenChange={setOpen}
        corner={corner}
        onCornerChange={setCorner}
        width={width}
        onWidthChange={setWidth}
        minWidth={160}
        maxWidth={400}
        playing={playing}
        onPlayingChange={setPlaying}
        onReturn={() => setReturned(true)}
      >
        <div style={{ background: "linear-gradient(135deg, #7a6a5d, #3d332b)" }} />
      </PictureInPicture>
    </div>
  );
}
