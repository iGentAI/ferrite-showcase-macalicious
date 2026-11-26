import { CalendarMiniMonth } from "macalicious/calendar-mini-month";

/**
 * Visual comparison target: the mini month at the foot of Calendar's sidebar, from its rule to
 * the window's bottom edge. Reference crop (2x pixels) x=114 y=996 w=326 h=326, i.e. 163 x
 * 163 pt: the sidebar is 165 pt wide and the crop leaves out the window's edge at the left,
 * the divider at the right and the rounded corner's last point at the bottom. Today is
 * 3 October 2019 in the light capture and 4 October in the dark one.
 */
export default function VisualCalendar({ day = 3 }: { day?: number }) {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 163,
        height: 163,
        background: "light-dark(#e8e9e9, #2c2d2e)",
      }}
    >
      <CalendarMiniMonth
        defaultMonth={new Date(2019, 9, 1)}
        today={new Date(2019, 9, day)}
        style={{ position: "absolute", top: 0, left: -1, width: 165 }}
      />
    </div>
  );
}
