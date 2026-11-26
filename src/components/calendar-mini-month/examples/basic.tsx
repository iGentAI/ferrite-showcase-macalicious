import { CalendarMiniMonth } from "macalicious/calendar-mini-month";

/** Choose a day, step through the months with the chevrons, or use the arrow keys. */
export default function Basic() {
  return (
    <CalendarMiniMonth
      defaultMonth={new Date(2019, 9, 1)}
      today={new Date(2019, 9, 3)}
      style={{ width: 165 }}
    />
  );
}
