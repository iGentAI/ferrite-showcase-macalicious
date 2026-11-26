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
    color: "#c157d9",
  },
];

/**
 * Visual comparison target: the week view of the Calendar capture, Aqua. The box is the pane
 * right of the sidebar, x=444 y=152 w=1872 h=1172 px of the capture (936 x 586 pt); the
 * comparison captures the part left of the event popover, marked with `data-crop`: 690 pt wide.
 *
 * An hour is 39 1/3 pt in the capture (lines every 78 or 79 px) and the grid is scrolled so that
 * the 8 AM line is 21.5 pt under the all-day band. At this width AppKit rounds the seven
 * columns to 123, 124, 124, 124, 123, 123 and 121 pt, which the columns hook reproduces.
 */
export default function VisualWeek() {
  return (
    <div style={{ position: "relative", width: 936, height: 586 }}>
      <CalendarWeekGrid
        start={new Date(2019, 8, 29)}
        now={new Date(2019, 9, 3, 15, 38)}
        events={events}
        defaultValue="screenshots"
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
          width: 690,
          height: 585,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
