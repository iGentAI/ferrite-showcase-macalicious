import { HudWindow, HudWindowButton, HudWindowSlider, HudWindowText } from "macalicious/hud-window";
import { useState } from "react";

const LENGTH = 769;

/** Seconds as a time code: 196 is 00:03:16. */
function timeCode(seconds: number) {
  const part = (value: number) => String(Math.floor(value)).padStart(2, "0");
  return `${part(seconds / 3600)}:${part((seconds / 60) % 60)}:${part(seconds % 60)}`;
}

/**
 * A floating controller over a picture. The picture is a gradient standing in for a movie, and
 * the glyphs are drawn for this example.
 */
export default function Controller() {
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(196);
  return (
    <div
      style={{
        display: "grid",
        placeItems: "end center",
        width: 400,
        height: 200,
        padding: 16,
        boxSizing: "border-box",
        background: "linear-gradient(120deg, #c9a06a, #6e8f5b 55%, #2f4b6e)",
      }}
    >
      <HudWindow
        variant="controller"
        role="toolbar"
        aria-label="Playback"
        style={{ width: 340, height: 75 }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            alignItems: "center",
            height: 49,
            padding: "0 12px",
          }}
        >
          <HudWindowSlider aria-label="Volume" defaultValue={70} style={{ width: 51 }} />
          <HudWindowButton
            aria-label={playing ? "Pause" : "Play"}
            aria-pressed={playing}
            onClick={() => setPlaying(!playing)}
          >
            <svg width="22" height="25" viewBox="0 0 22 25" aria-hidden="true">
              <path
                d={playing ? "M3 0h5v25H3zM14 0h5v25h-5z" : "M0 0l22 12.5L0 25z"}
                fill="currentColor"
              />
            </svg>
          </HudWindowButton>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 12px" }}>
          <HudWindowText>{timeCode(time)}</HudWindowText>
          <HudWindowSlider
            variant="scrubber"
            aria-label="Timeline"
            aria-valuetext={`${timeCode(time)} of ${timeCode(LENGTH)}`}
            max={LENGTH}
            value={time}
            onValueChange={setTime}
            style={{ flex: "1 1 auto" }}
          />
          <HudWindowText>{timeCode(LENGTH)}</HudWindowText>
        </div>
      </HudWindow>
    </div>
  );
}
