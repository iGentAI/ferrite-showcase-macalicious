import { CircularSlider } from "macalicious/circular-slider";

/**
 * Fixture for the disabled state. No reference screenshot shows a circular slider, so
 * `circular-slider.visual.json` checks the pixels the spec infers: the whole control at half
 * opacity over the window background.
 *
 * 84 x 48 pt, laid out as visual-states, on the window background.
 *   24 pt dial, x 8 to 32, y 8 to 32, centre (20, 20); value 25 of 100, so the dot is at three
 *   o'clock, centred on (27.5, 20)
 *   four tick marks: the dial centred on (60, 24); value 0, so the dot is centred on
 *   (60, 16.5); tick dots centred on (60, 9), (75, 24), (60, 39) and (45, 24)
 */
export default function VisualDisabled() {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        padding: 8,
        background: "light-dark(#ececec, #323232)",
      }}
    >
      <CircularSlider aria-label="Dial" disabled defaultValue={25} />
      <CircularSlider aria-label="Dial with tick marks" disabled tickMarks={4} />
    </div>
  );
}
