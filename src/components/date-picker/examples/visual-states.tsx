import { DatePicker } from "macalicious/date-picker";

/**
 * Fixture for the states no reference screenshot shows (a selected element, keyboard focus,
 * a window that is not key). `date-picker.visual.json` puts it into each state with real
 * input and checks the pixels it expects.
 *
 * 112 x 39 pt: 8 pt of window background on every side, so the focus ring is inside the
 * capture. The field's edge runs x 8 to 87.5 and y 8 to 31; the month, its first element,
 * starts 2.25 pt inside it and is two tabular digits wide, on a 16 pt line centred in the
 * field: x 10.25 to 26.25, y 11.75 to 27.75.
 */
export default function VisualStates() {
  return (
    <div style={{ padding: 8, lineHeight: 0, background: "light-dark(#ececec, #2f3032)" }}>
      <DatePicker
        aria-label="Date"
        elements="yearMonthDay"
        defaultValue={new Date(2019, 9, 3)}
        style={{ width: 96 }}
      />
    </div>
  );
}
