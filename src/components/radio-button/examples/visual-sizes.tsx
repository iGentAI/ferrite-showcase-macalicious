import { RadioButton, RadioGroup } from "macalicious/radio-button";

/**
 * Target of the size checks in radio-button.visual.json: a small and a mini radio button. No
 * screenshot shows either size, so the runner checks only that the circles are 14 and 12 pt.
 *
 * 46 x 24 pt. The small circle is at x 5..19, y 5..19 and is on; the mini circle is at
 * x 29..41, y 5..17 and is off.
 */
export default function VisualSizes() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 46,
        height: 24,
        padding: 5,
        background: "light-dark(#ececec, #323232)",
      }}
    >
      <RadioGroup orientation="horizontal" defaultValue="small" aria-label="Sizes">
        <RadioButton size="small" value="small" aria-label="Small" />
        <RadioButton size="mini" value="mini" aria-label="Mini" />
      </RadioGroup>
    </div>
  );
}
