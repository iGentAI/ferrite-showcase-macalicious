import { DatePickerCalendar } from "macalicious/date-picker";

/**
 * Fixture for the states of the calendar no reference screenshot shows (enabled, keyboard
 * focus, a key that turns the month, a window that is not key).
 *
 * 154 x 163 pt: 8 pt of window background on every side and half a point more on the
 * right, so the capture is whole pixels wide. The calendar's edge runs x 8 to
 * 145.5 and y 8 to 155. 3 October 2019 is in the first row, fifth column: its highlight
 * runs x 85.5 to 104.5 and y 46.5 to 62.5. 3 November, a month on, is in the second row,
 * first column: x 11.5 to 30.5 and y 64.5 to 80.5.
 */
export default function VisualStatesCalendar() {
  return (
    <div
      style={{
        padding: "8px 8.5px 8px 8px",
        lineHeight: 0,
        background: "light-dark(#ececec, #2f3032)",
      }}
    >
      <DatePickerCalendar aria-label="Date" defaultValue={new Date(2019, 9, 3)} />
    </div>
  );
}
