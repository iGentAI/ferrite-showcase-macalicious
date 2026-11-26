import { Switch } from "macalicious/switch";

/**
 * Fixture for the states no reference screenshot shows (on, pressed, keyboard focus, a window
 * that is not key, another accent). `switch.visual.json` puts it into each state with real
 * input and checks the pixels it expects.
 *
 * 104 x 37 pt: 8 pt of page on every side, so the focus ring is inside the capture. The off
 * switch's track is x 8 to 46, the on switch's x 58 to 96, both y 8 to 29. The off knob's
 * fill is the 19 pt disc centred on (18.5, 18.5), the on knob's the one centred on
 * (85.5, 18.5).
 */
export default function VisualStates() {
  return (
    <div style={{ display: "flex", gap: 12, padding: 8 }}>
      <Switch data-name="off" aria-label="Off" />
      <Switch data-name="on" aria-label="On" defaultChecked />
    </div>
  );
}
