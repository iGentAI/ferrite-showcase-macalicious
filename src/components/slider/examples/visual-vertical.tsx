import { Slider } from "macalicious/slider";

/**
 * Fixture for the vertical orientation and the smaller sizes, which no reference screenshot
 * shows. `slider.visual.json` checks the pixels it expects.
 *
 * 107 x 116 pt, 8 pt of page on every side; the sliders are 100 pt long, their values in the
 * middle, so every thumb is centred on y=58.
 *   x 8 to 23    vertical, no ticks: track x 14 to 17, filled below the knob
 *   x 35 to 55   vertical with three tick marks: track x 39 to 42, the thumb points to the
 *                trailing side, its tip at x=52; marks from x=50.5 to 54.5 at y=15.5, 58, 100.5
 *   x 67 to 76   vertical mini: 9 pt knob, track x 70 to 73
 *   x 88 to 99   vertical small: 11 pt knob, track x 92 to 95
 */
export default function VisualVertical() {
  return (
    <div style={{ display: "flex", gap: 12, height: 100, padding: 8 }}>
      <Slider aria-label="Vertical" orientation="vertical" defaultValue={50} />
      <Slider
        aria-label="Vertical, tick marks"
        orientation="vertical"
        tickMarks={3}
        defaultValue={50}
      />
      <Slider aria-label="Vertical, mini" orientation="vertical" size="mini" defaultValue={50} />
      <Slider aria-label="Vertical, small" orientation="vertical" size="small" defaultValue={50} />
    </div>
  );
}
