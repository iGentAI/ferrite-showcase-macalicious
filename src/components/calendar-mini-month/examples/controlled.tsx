import { CalendarMiniMonth } from "macalicious/calendar-mini-month";
import { Label } from "macalicious/label";
import { useState } from "react";

const long = new Intl.DateTimeFormat("en-US", { dateStyle: "full" });

/** Weeks that start on Monday, with the selected day and the month shown both controlled. */
export default function Controlled() {
  const [day, setDay] = useState<Date | null>(new Date(2019, 9, 16));
  const [month, setMonth] = useState(new Date(2019, 9, 1));
  return (
    <div style={{ display: "grid", gap: 8, justifyItems: "start" }}>
      <CalendarMiniMonth
        value={day}
        onValueChange={setDay}
        month={month}
        onMonthChange={setMonth}
        today={new Date(2019, 9, 3)}
        weekStartsOn={1}
        style={{ width: 165 }}
      />
      <Label color="secondary" role="status">
        {day ? long.format(day) : "No day selected."}
      </Label>
    </div>
  );
}
