import { NowPlayingLcd } from "macalicious/now-playing-lcd";
import { useState } from "react";

/**
 * With `onSeek` the progress line is a slider. Move the pointer over the display, or Tab to
 * it, to see the knob and the time labels; drag, or press the arrow keys, to seek.
 */
export default function Seekable() {
  const [elapsed, setElapsed] = useState(1520);
  return (
    <NowPlayingLcd
      variant="podcasts"
      title="Episode 12: Field Notes"
      subtitle="An Example Show — October 5, 2026"
      artwork={
        <div
          role="img"
          aria-label="Artwork of An Example Show"
          style={{
            width: "100%",
            height: "100%",
            background: "linear-gradient(135deg, #7d5fff, #18dcff)",
          }}
        />
      }
      elapsed={elapsed}
      duration={3900}
      onSeek={setElapsed}
      style={{ width: 351 }}
    />
  );
}
