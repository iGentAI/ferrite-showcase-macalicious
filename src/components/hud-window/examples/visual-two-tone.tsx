import { HudWindow, HudWindowButton } from "macalicious/hud-window";
import type { CSSProperties } from "react";

/**
 * Visual check target: the controller's material over a backdrop of two flat tones that meet
 * under the middle of the panel, a slate blue on the left and a sand on the right. The tones
 * are abstract: they are no picture and are taken from none.
 *
 * A translucent panel over two known tones shows each part of its recipe apart. Far from the
 * seam the backdrop is one tone, and the panel is that tone saturated and under the tint. At
 * the seam the blur has mixed the two tones evenly, and 30 pt to either side, one standard
 * deviation of the blur, by 16% and 84%. A glyph adds its light to whichever fill is under it.
 * hud-window.visual.json holds those pixels to values computed from the tokens.
 */
const TONES = "linear-gradient(to right, #5a6e82 50%, #a08c6e 50%)";

const at = (left: number, top: number): CSSProperties => ({ position: "absolute", left, top });

const square = (
  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
    <path d="M0 0h12v12H0z" fill="currentColor" />
  </svg>
);

export default function VisualTwoTone() {
  return (
    <div
      style={{
        position: "relative",
        width: 440,
        height: 75,
        overflow: "hidden",
        background: TONES,
      }}
    >
      <HudWindow
        variant="controller"
        role="toolbar"
        aria-label="Playback"
        style={{ width: 440, height: 75 }}
      >
        <HudWindowButton aria-label="Stop" style={at(12, 18)}>
          {square}
        </HudWindowButton>
        <HudWindowButton aria-label="Record" style={at(416, 18)}>
          {square}
        </HudWindowButton>
      </HudWindow>
    </div>
  );
}
