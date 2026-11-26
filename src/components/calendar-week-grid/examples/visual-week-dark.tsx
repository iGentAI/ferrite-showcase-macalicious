import { CalendarWeekGrid, type CalendarWeekGridEvent } from "macalicious/calendar-week-grid";
import type { CSSProperties } from "react";

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
    color: "#cc74e1",
  },
  {
    id: "more",
    title: "Make even more Screenshots",
    start: new Date(2019, 9, 4, 10),
    end: new Date(2019, 9, 4, 13),
    color: "#cc74e1",
  },
];

/**
 * Visual comparison target: the week view of the dark Calendar capture, a day later than the
 * light one: Friday is today, its event is selected and Thursday's is not. The box is the pane
 * right of the sidebar, x=444 y=152 w=1872 h=1172 px (936 x 586 pt); the comparison captures
 * the part left of the event popover, marked with `data-crop`: 812 pt wide.
 */
export default function VisualWeekDark() {
  return (
    <div style={{ position: "relative", width: 936, height: 586 }}>
      <CalendarWeekGrid
        start={new Date(2019, 8, 29)}
        now={new Date(2019, 9, 4, 10, 57, 30)}
        events={events}
        defaultValue="more"
        hourHeight={118 / 3}
        defaultScrollHour={8 - 21.5 / (118 / 3)}
        style={
          {
            width: 936,
            height: 586,
            "--mac-calendar-week-grid-columns": "123px 124px 124px 124px 123px 123px 121px",
          } as CSSProperties
        }
      />
      <div
        data-crop="week"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 812,
          height: 585,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
