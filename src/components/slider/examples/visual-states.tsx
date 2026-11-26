import { Slider } from "macalicious/slider";

/**
 * Fixture for the states no reference screenshot shows (pressed, keyboard focus, a window
 * that is not key, another accent, disabled). `slider.visual.json` puts it into each state
 * with real input and checks the pixels it expects.
 *
 * 116 x 90 pt, 8 pt of page on every side; each slider is 100 pt long, its value in the
 * middle, so every thumb is centred on x=58.
 *   #round     y 8 to 23: track y 14 to 17, filled from x=8, knob fill centred on (58, 15.5)
 *   #ticks     y 35 to 55: track y 39 to 42, thumb fill from y=35 to its tip at y=52, tick
 *              marks at x=15.5, 58 and 100.5 from y=50.5 to 54.5
 *   #disabled  y 67 to 82: as #round
 */
export default function VisualStates() {
  return (
    <div style={{ display: "grid", gap: 12, width: 100, padding: 8 }}>
      <Slider id="round" aria-label="Round" defaultValue={50} />
      <Slider id="ticks" aria-label="Tick marks" tickMarks={3} defaultValue={50} />
      <Slider id="disabled" aria-label="Disabled" defaultValue={50} disabled />
    </div>
  );
}
