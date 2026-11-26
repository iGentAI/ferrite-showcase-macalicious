import { DatePickerCalendar } from "macalicious/date-picker";

/**
 * Visual comparison target: the disabled calendar of the Date & Time preference pane.
 *
 * Reference crop (2x pixels) x=426 y=452 w=286 h=304, that is 143 x 152 pt. The calendar's
 * edge runs x 431 to 705 (137.5 pt) and y 457 to 750 (147 pt): 2.5 pt from the crop's left
 * and top edges.
 *
 * The light screenshot shows 3 October 2019, the dark one 4 October: `day` selects it.
 */
export default function VisualCalendar({ day = 3 }: { day?: number }) {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 143,
        height: 152,
        padding: "2.5px 0 0 2.5px",
        lineHeight: 0,
        background: "light-dark(#e3e3e3, #363637)",
      }}
    >
      <DatePickerCalendar aria-label="Date" value={new Date(2019, 9, day)} disabled />
    </div>
  );
}
