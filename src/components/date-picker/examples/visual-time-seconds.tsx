import { DatePicker } from "macalicious/date-picker";

/**
 * Visual comparison target: the disabled time field and its stepper in the Date & Time
 * preference pane.
 *
 * Reference crop (2x pixels) x=904 y=386 w=216 h=56, that is 108 x 28 pt. The field's edge
 * runs x 910 to 1080 (85.5 pt) and y 391 to 436: 3 pt from the crop's left edge and 2.5 pt
 * from its top. The stepper's outline starts 4 pt after the field.
 *
 * The light screenshot shows 10:56:59 AM, the dark one 10:30:38 AM: `minutes` and `seconds`
 * select it.
 */
export default function VisualTimeSeconds({
  minutes = 56,
  seconds = 59,
}: {
  minutes?: number;
  seconds?: number;
}) {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 108,
        height: 28,
        padding: "2.5px 0 0 3px",
        lineHeight: 0,
        background: "light-dark(#e3e3e3, #363637)",
      }}
    >
      <DatePicker
        aria-label="Time"
        elements="hourMinuteSecond"
        value={new Date(2019, 9, 3, 10, minutes, seconds)}
        disabled
        style={{ width: 102 }}
      />
    </div>
  );
}
