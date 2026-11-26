import { RadioButton, RadioGroup } from "macalicious/radio-button";

/**
 * Target of the state checks in radio-button.visual.json: an off and an on radio button,
 * pressed with the mouse, focused with Tab or put in a window that is not key by the runner,
 * which then reads single pixels. No screenshot shows these states.
 *
 * 52 x 26 pt. The off circle is at x 5..21, the on circle at x 31..47, both at y 5..21, on the
 * untinted window background.
 */
export default function VisualStates() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 52,
        height: 26,
        padding: 5,
        background: "light-dark(#ececec, #323232)",
      }}
    >
      <RadioGroup orientation="horizontal" defaultValue="on" aria-label="States">
        <RadioButton value="off" aria-label="Off" />
        <RadioButton value="on" aria-label="On" />
      </RadioGroup>
    </div>
  );
}
