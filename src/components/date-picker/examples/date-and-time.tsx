import { DatePicker, DatePickerCalendar, DatePickerClock } from "macalicious/date-picker";
import { useState } from "react";

/**
 * The arrangement of the Date & Time preference pane: a date field above the calendar and a
 * time field above the clock, all four showing one date. The fields are centred on the
 * calendar and the clock, 10 pt and 26.5 pt above them.
 */
export default function DateAndTime() {
  const [value, setValue] = useState(new Date(2019, 9, 3, 10, 56, 59));
  return (
    <div style={{ display: "flex", gap: 48, alignItems: "start" }}>
      <div style={{ display: "grid", gap: 10, justifyItems: "center" }}>
        <DatePicker
          aria-label="Date"
          elements="yearMonthDay"
          value={value}
          onValueChange={setValue}
        />
        <DatePickerCalendar aria-label="Date" value={value} onValueChange={setValue} />
      </div>
      <div style={{ display: "grid", gap: 26.5, justifyItems: "center" }}>
        <DatePicker
          aria-label="Time"
          elements="hourMinuteSecond"
          value={value}
          onValueChange={setValue}
        />
        <DatePickerClock value={value} />
      </div>
    </div>
  );
}
