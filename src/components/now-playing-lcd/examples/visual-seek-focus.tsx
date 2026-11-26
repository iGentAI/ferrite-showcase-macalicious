import { NowPlayingLcd } from "macalicious/now-playing-lcd";
import { useState } from "react";

/**
 * Visual check only: a seekable display with 6 pt of room around it, so that the capture
 * includes the focus ring, which is drawn outside the panel.
 */
export default function VisualSeekFocus() {
  const [elapsed, setElapsed] = useState(1520);
  return (
    <div style={{ padding: 6 }}>
      <NowPlayingLcd
        variant="podcasts"
        title="Episode 12: Field Notes"
        subtitle="An Example Show"
        elapsed={elapsed}
        duration={3900}
        onSeek={setElapsed}
        style={{ width: 351 }}
      />
    </div>
  );
}
