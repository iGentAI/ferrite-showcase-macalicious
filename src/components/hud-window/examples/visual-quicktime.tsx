import { HudWindow, HudWindowButton, HudWindowSlider, HudWindowText } from "macalicious/hud-window";
import { SystemImage } from "macalicious/system-image";
import type { CSSProperties } from "react";

/**
 * Visual check target: QuickTime Player's floating controller, 440 x 75 pt, paused with the
 * volume at its maximum, laid out as in the two QuickTime captures (Aqua: 880 x 150 px at
 * 1143, 1325; Dark Aqua: at 1018, 1209; the controller is the same dark panel in both, only
 * the timeline's position differs).
 *
 * The backdrop is one flat grey. In the captures the controller lies over a third party's
 * movie, and a vibrant panel shows nothing but what is behind it, so the captures are not
 * reproduced or compared here: over a flat grey the panel's colours follow from the tokens,
 * and hud-window.visual.json holds them at the places measured in the captures.
 *
 * The glyphs are drawn for this example at the measured sizes; they are not Apple's artwork.
 * The two sliders are `HudWindowSlider`s at the measured places: the volume at its maximum,
 * and the timeline with its bar where the capture has it (the track is 258 pt and the bar
 * 3 pt, so the value runs over 255 pt).
 */
const BACKDROP = "#707070";

const FRAMES = {
  light: { elapsed: "00:03:16:12", thumb: 156.5 },
  dark: { elapsed: "00:04:40:02", thumb: 184.5 },
};

const at = (left: number, top: number, width: number, height: number): CSSProperties => ({
  position: "absolute",
  left,
  top,
  width,
  height,
});

export default function VisualQuicktime({ capture = "light" }: { capture?: "light" | "dark" }) {
  const { elapsed, thumb } = FRAMES[capture];
  return (
    <div
      style={{
        position: "relative",
        width: 440,
        height: 75,
        overflow: "hidden",
        background: BACKDROP,
      }}
    >
      <HudWindow
        variant="controller"
        role="toolbar"
        aria-label="Playback"
        style={{ width: 440, height: 75 }}
      >
        <HudWindowButton aria-label="Mute" style={at(12, 18.5, 12, 12)}>
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M0 3.5h2.5L6.5 0v12L2.5 8.5H0z" fill="currentColor" />
            <path d="M9 3.5a3.5 3.5 0 0 1 0 5" fill="none" stroke="currentColor" />
          </svg>
        </HudWindowButton>
        <HudWindowSlider
          variant="knob"
          aria-label="Volume"
          defaultValue={100}
          style={at(31, 19, 51, 11)}
        />
        <HudWindowButton aria-label="Full Volume" style={at(88, 17, 20, 15)}>
          <svg width="20" height="15" viewBox="0 0 20 15" aria-hidden="true">
            <path d="M0 5h2.5l4-3.5v12L2.5 10H0z" fill="currentColor" />
            <path
              d="M9 5a3.5 3.5 0 0 1 0 5M12 2.5a7 7 0 0 1 0 10M15 0.5a10 10 0 0 1 0 14"
              fill="none"
              stroke="currentColor"
            />
          </svg>
        </HudWindowButton>
        <HudWindowButton aria-label="Rewind" style={at(153, 17, 24, 15)}>
          <svg width="24" height="15" viewBox="0 0 24 15" aria-hidden="true">
            <path d="M12 0v15L0 7.5zM24 0v15L12 7.5z" fill="currentColor" />
          </svg>
        </HudWindowButton>
        <HudWindowButton aria-label="Play" style={at(210, 12, 22, 25)}>
          <svg width="22" height="25" viewBox="0 0 22 25" aria-hidden="true">
            <path d="M0 0l22 12.5L0 25z" fill="currentColor" />
          </svg>
        </HudWindowButton>
        <HudWindowButton aria-label="Fast Forward" style={at(263, 17, 24, 15)}>
          <svg width="24" height="15" viewBox="0 0 24 15" aria-hidden="true">
            <path d="M0 0v15l12-7.5zM12 0v15l12-7.5z" fill="currentColor" />
          </svg>
        </HudWindowButton>
        <HudWindowButton aria-label="AirPlay" style={at(331, 18, 16, 14)}>
          <svg width="16" height="14" viewBox="0 0 16 14" aria-hidden="true">
            <path
              d="M3.5 10.25H1.75a1 1 0 0 1-1-1v-7.5a1 1 0 0 1 1-1h12.5a1 1 0 0 1 1 1v7.5a1 1 0 0 1-1 1H12.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path d="M8 9l4.5 5h-9z" fill="currentColor" />
          </svg>
        </HudWindowButton>
        <HudWindowButton aria-label="Share" style={at(371, 16, 11, 15)}>
          <SystemImage name="share" />
        </HudWindowButton>
        <HudWindowButton aria-label="Picture in Picture" style={at(407.5, 17.5, 20.5, 16.5)}>
          <svg width="20.5" height="16.5" viewBox="0 0 20.5 16.5" aria-hidden="true">
            <path
              d="M7.5 12.25H1.75a1 1 0 0 1-1-1v-9.5a1 1 0 0 1 1-1h14.5a1 1 0 0 1 1 1V7M4 4l4 4M8 5v3H5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <rect x="8.5" y="8.5" width="12" height="8" rx="1.5" fill="currentColor" />
          </svg>
        </HudWindowButton>
        <HudWindowText style={{ position: "absolute", left: 11.5, top: 48.5 }}>
          {elapsed}
        </HudWindowText>
        <HudWindowSlider
          variant="scrubber"
          aria-label="Timeline"
          aria-valuetext={elapsed}
          max={255}
          step={0.5}
          defaultValue={thumb - 91}
          style={at(91, 49, 258, 15)}
        />
        <HudWindowText style={{ position: "absolute", right: 12, top: 48.5 }}>
          00:12:49:22
        </HudWindowText>
      </HudWindow>
    </div>
  );
}
