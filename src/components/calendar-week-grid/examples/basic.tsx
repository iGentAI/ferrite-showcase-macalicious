import { CalendarWeekGrid, type CalendarWeekGridEvent } from "macalicious/calendar-week-grid";

const events: CalendarWeekGridEvent[] = [
  {
    id: "holiday",
    title: "Rosh Hashanah",
    start: new Date(2019, 8, 30),
    end: new Date(2019, 9, 1),
    allDay: true,
  },
  {
    id: "screenshots",
    title: "Make Catalina Screenshots",
    start: new Date(2019, 9, 3, 14),
    end: new Date(2019, 9, 3, 16, 45),
    color: "light-dark(#c157d9, #cc74e1)",
  },
  {
    id: "lunch",
    title: "Lunch",
    start: new Date(2019, 9, 1, 12),
    end: new Date(2019, 9, 1, 13),
    color: "light-dark(#30b94d, #32d74b)",
  },
];

/** Click an event to select it; click the empty grid to clear the selection. */
export default function Basic() {
  return (
    <CalendarWeekGrid
      start={new Date(2019, 8, 29)}
      now={new Date(2019, 9, 3, 15, 38)}
      events={events}
      defaultValue="screenshots"
      defaultScrollHour={9.5}
      style={{ width: "100%", maxWidth: 760, height: 420 }}
    />
  );
}
