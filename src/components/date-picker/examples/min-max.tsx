import { DatePicker, DatePickerCalendar } from "macalicious/date-picker";
import { useState } from "react";

/** A date kept inside a range, 2 to 20 October 2019: the days outside it are dimmed. */
export default function MinMax() {
  const [value, setValue] = useState(new Date(2019, 9, 3));
  const min = new Date(2019, 9, 2);
  const max = new Date(2019, 9, 20);
  return (
    <div style={{ display: "grid", gap: 10, justifyItems: "center", width: "max-content" }}>
      <DatePicker
        aria-label="Delivery date"
        elements="yearMonthDay"
        value={value}
        onValueChange={setValue}
        min={min}
        max={max}
      />
      <DatePickerCalendar
        aria-label="Delivery date"
        value={value}
        onValueChange={setValue}
        min={min}
        max={max}
      />
    </div>
  );
}
