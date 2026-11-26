import { CircularSlider } from "macalicious/circular-slider";

/**
 * Fixture for the pixel checks of `circular-slider.visual.json`. No reference screenshot
 * shows a circular slider, so there is no crop to compare with: the checks hold the component
 * to the values the spec infers.
 *
 * 84 x 48 pt, 8 pt of page on every side.
 *   #dial    24 pt dial, x 8 to 32, y 8 to 32, centre (20, 20); value 25 of 100, so the 4 pt
 *            dot is at three o'clock, centred on (27.5, 20)
 *   #ticked  four tick marks: a 32 pt box, x 44 to 76, y 8 to 40, the dial inside it centred
 *            on (60, 24); value 0, so the dot is at twelve o'clock, centred on (60, 16.5);
 *            2 pt tick dots centred on (60, 9), (75, 24), (60, 39) and (45, 24)
 */
export default function VisualStates() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: 8 }}>
      <CircularSlider id="dial" aria-label="Dial" defaultValue={25} />
      <CircularSlider id="ticked" aria-label="Dial with tick marks" tickMarks={4} />
    </div>
  );
}
