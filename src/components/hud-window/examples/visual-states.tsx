import { HudWindow, HudWindowButton } from "macalicious/hud-window";

const glyph = (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <rect width="16" height="16" fill="currentColor" />
  </svg>
);

/**
 * Fixture for the pixel checks in `hud-window.visual.json` of what no screenshot shows: the
 * titled HUD panel and the states of a glyph button. A 300 x 120 pt box of the page background.
 *
 * Panel: 130 x 100 pt at 10, 10. Its title bar ends at y 29; the body is padded by 6 pt above
 * and 12 pt at the sides, so the first button is the square from 22, 35 to 38, 51 and the
 * second, disabled, the square from 50, 35 to 66, 51.
 *
 * Controller: 140 x 40 pt at 150, 10, with one button from 162, 22 to 178, 38.
 */
export default function VisualStates() {
  return (
    <div style={{ position: "relative", width: 300, height: 120 }}>
      <HudWindow
        title="Adjust"
        onClose={() => {}}
        style={{ position: "absolute", left: 10, top: 10, width: 130, height: 100 }}
      >
        <div style={{ display: "flex", gap: 12 }}>
          <HudWindowButton aria-label="Stop">{glyph}</HudWindowButton>
          <HudWindowButton aria-label="Record" disabled>
            {glyph}
          </HudWindowButton>
        </div>
      </HudWindow>
      <HudWindow
        variant="controller"
        aria-label="Playback"
        style={{ position: "absolute", left: 150, top: 10, width: 140, height: 40 }}
      >
        <HudWindowButton aria-label="Stop" style={{ position: "absolute", left: 12, top: 12 }}>
          {glyph}
        </HudWindowButton>
      </HudWindow>
    </div>
  );
}
