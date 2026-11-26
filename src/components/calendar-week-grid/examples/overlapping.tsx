import { CalendarWeekGrid, type CalendarWeekGridEvent } from "macalicious/calendar-week-grid";

const day = (hour: number, minute = 0) => new Date(2019, 9, 3, hour, minute);

const events: CalendarWeekGridEvent[] = [
  { id: "review", title: "Design review", start: day(9), end: day(11) },
  {
    id: "call",
    title: "Call with print shop",
    start: day(9, 30),
    end: day(10, 30),
    color: "light-dark(#f19a37, #ff9f0a)",
  },
  {
    id: "coffee",
    title: "Coffee",
    start: day(10),
    end: day(10, 45),
    color: "light-dark(#30b94d, #32d74b)",
  },
  {
    id: "offsite",
    title: "Offsite",
    start: new Date(2019, 9, 3),
    end: new Date(2019, 9, 5),
    allDay: true,
    color: "light-dark(#c157d9, #cc74e1)",
  },
  {
    id: "holiday",
    title: "Local holiday",
    start: new Date(2019, 9, 4),
    end: new Date(2019, 9, 5),
    allDay: true,
  },
];

/**
 * Three days: events that overlap share their column, and all-day events lie across the days
 * they cover, one row each where they meet.
 */
export default function Overlapping() {
  return (
    <CalendarWeekGrid
      start={new Date(2019, 9, 3)}
      days={3}
      events={events}
      defaultScrollHour={8.5}
      style={{ width: "100%", maxWidth: 560, height: 320 }}
    />
  );
}
