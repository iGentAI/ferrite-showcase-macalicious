import { Switch } from "macalicious/switch";

/**
 * Fixture for the disabled state, which no reference screenshot shows. `switch.visual.json`
 * checks the pixels it expects: the whole control at half opacity over the window background.
 *
 * 104 x 37 pt, laid out as visual-states: 8 pt of window background on every side, the off
 * switch's track at x 8 to 46, the on switch's at x 58 to 96, both y 8 to 29; the off knob is
 * centred on (18.5, 18.5), the on knob on (85.5, 18.5).
 */
export default function VisualDisabled() {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        padding: 8,
        background: "light-dark(#ececec, #323232)",
      }}
    >
      <Switch aria-label="Off" disabled />
      <Switch aria-label="On" disabled defaultChecked />
    </div>
  );
}
