import { RadioButton, RadioGroup } from "macalicious/radio-button";

/**
 * Target of the forced-colours checks in radio-button.visual.json: the runner turns the
 * browser's forced-colours mode on (Windows high contrast) and reads single pixels. In that
 * mode the browser replaces colours with the user's system colours, so what is checked is that
 * each state can still be told from the others, not a Catalina colour.
 *
 * 130 x 26 pt. Five 16 pt circles at y 5..21: off at x 5..21, on at x 31..47, mixed at
 * x 57..73, disabled and off at x 83..99, disabled and on at x 109..125.
 */
export default function VisualForcedColors() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        display: "flex",
        gap: 10,
        width: 130,
        height: 26,
        padding: 5,
      }}
    >
      <RadioGroup orientation="horizontal" defaultValue="on" aria-label="Forced colours">
        <RadioButton value="off" aria-label="Off" />
        <RadioButton value="on" aria-label="On" />
        <RadioButton value="mixed" mixed aria-label="Mixed" />
        <RadioButton value="disabled-off" disabled aria-label="Disabled, off" />
      </RadioGroup>
      <RadioGroup disabled defaultValue="on" aria-label="Forced colours, disabled">
        <RadioButton value="on" aria-label="Disabled, on" />
      </RadioGroup>
    </div>
  );
}
