import { DatePicker } from "macalicious/date-picker";

/**
 * Visual comparison target: the disabled date field and its stepper in the Date & Time
 * preference pane (the pane is locked to "Set date and time automatically").
 *
 * Reference crop (2x pixels) x=468 y=388 w=204 h=56, that is 102 x 28 pt. The field's edge
 * runs x 474 to 632 (79.5 pt) and y 393 to 438: 3 pt from the crop's left edge and 2.5 pt
 * from its top. The stepper's outline starts 4 pt after the field.
 *
 * The light screenshot shows 3 October 2019, the dark one 4 October: `day` selects it.
 */
export default function VisualDate({ day = 3 }: { day?: number }) {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 102,
        height: 28,
        padding: "2.5px 0 0 3px",
        lineHeight: 0,
        background: "light-dark(#e3e3e3, #363637)",
      }}
    >
      <DatePicker
        aria-label="Date"
        elements="yearMonthDay"
        value={new Date(2019, 9, day)}
        disabled
        style={{ width: 96 }}
      />
    </div>
  );
}
