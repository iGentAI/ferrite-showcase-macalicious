import { DatePickerClock } from "macalicious/date-picker";

/**
 * Visual comparison target: the clock of the Date & Time preference pane.
 *
 * Reference crop (2x pixels) x=886 y=484 w=252 h=250, that is 126 x 125 pt. The clock runs
 * x 892 to 1131 and y 489 to 728 (120 pt): 3 pt from the crop's left edge and 2.5 pt from
 * its top.
 *
 * The light screenshot shows 10:56:59 AM, the dark one 10:30:38 AM: `minutes` and `seconds`
 * select it.
 */
export default function VisualClock({
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
        width: 126,
        height: 125,
        padding: "2.5px 0 0 3px",
        lineHeight: 0,
        background: "light-dark(#e3e3e3, #363637)",
      }}
    >
      <DatePickerClock value={new Date(2019, 9, 3, 10, minutes, seconds)} />
    </div>
  );
}
