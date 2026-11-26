import { CalendarWeekGrid, type CalendarWeekGridEvent } from "macalicious/calendar-week-grid";

const events: CalendarWeekGridEvent[] = [
  {
    id: "screenshots",
    title: "Make Catalina Screenshots",
    start: new Date(2019, 9, 3, 14),
    end: new Date(2019, 9, 3, 16, 45),
    color: "light-dark(#c157d9, #cc74e1)",
  },
];

/** One day, on a 24-hour clock, with 30 pt hours. */
export default function Day() {
  return (
    <CalendarWeekGrid
      start={new Date(2019, 9, 3)}
      days={1}
      now={new Date(2019, 9, 3, 15, 38)}
      events={events}
      hourHeight={30}
      defaultScrollHour={11}
      formatTime={(date) => `${date.getHours()}:${`${date.getMinutes()}`.padStart(2, "0")}`}
      noonLabel={null}
      allDayLabel="all day"
      style={{ width: 320, height: 300 }}
    />
  );
}
